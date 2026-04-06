/// Windows-only custom OLE IDropTarget.
///
/// With `dragDropEnabled: false`, WebView2 has its own IDropTarget but does NOT
/// expose File.path or cross-process drag data in JavaScript.
/// We revoke WebView2's drop target and register our own to read both
/// CF_HDROP (file paths) and CF_UNICODETEXT (URL text) natively, then emit
/// Tauri events to the frontend.
///
/// Uses windows-sys 0.52 (raw FFI) with a hand-rolled COM vtable — no
/// `#[implement]` or `_Impl` traits needed.
/// HWND is received as `isize` to avoid type incompatibility with Tauri's
/// own windows-rs dependency.
#[cfg(target_os = "windows")]
pub mod win {
    use std::ffi::c_void;
    use std::mem::ManuallyDrop;
    use std::sync::atomic::{AtomicU32, Ordering};
    use tauri::{AppHandle, Emitter};
    use windows_sys::Win32::{
        Foundation::{BOOL, FALSE, HWND, LPARAM, TRUE},
        System::{
            Memory::{GlobalLock, GlobalSize, GlobalUnlock},
            Ole::{OleInitialize, RegisterDragDrop, RevokeDragDrop, DROPEFFECT_COPY},
        },
        UI::{
            Shell::{DragQueryFileW, HDROP},
            WindowsAndMessaging::{EnumChildWindows, GetClassNameW},
        },
    };

    // ── HRESULT constants ─────────────────────────────────────────────────────

    const S_OK: i32 = 0;
    const E_NOINTERFACE: i32 = -2147467262_i32; // 0x80004002

    // ── Clipboard format constants ────────────────────────────────────────────

    const CF_HDROP_FMT: u16 = 15;
    const CF_UNICODETEXT_FMT: u16 = 13;

    // ── FORMATETC constants ───────────────────────────────────────────────────

    const DVASPECT_CONTENT: u32 = 1;
    const TYMED_HGLOBAL: u32 = 1;

    // ── GUID ──────────────────────────────────────────────────────────────────

    #[repr(C)]
    struct GUID {
        data1: u32,
        data2: u16,
        data3: u16,
        data4: [u8; 8],
    }

    // IUnknown IID: {00000000-0000-0000-C000-000000000046}
    const IID_IUNKNOWN: GUID = GUID {
        data1: 0x00000000,
        data2: 0x0000,
        data3: 0x0000,
        data4: [0xC0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46],
    };

    // IDropTarget IID: {00000122-0000-0000-C000-000000000046}
    const IID_IDROPTARGET: GUID = GUID {
        data1: 0x00000122,
        data2: 0x0000,
        data3: 0x0000,
        data4: [0xC0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46],
    };

    // ── Windows ABI structs ───────────────────────────────────────────────────

    // POINTL: two i32s, passed by value in IDropTarget methods (8 bytes total)
    #[repr(C)]
    #[derive(Clone, Copy)]
    struct POINTL {
        x: i32,
        y: i32,
    }

    // FORMATETC: 32 bytes on x64
    //   cf_format (2) + pad (6) + ptd (8) + dwAspect (4) + lindex (4) + tymed (4) + implicit_pad (4) = 32
    #[repr(C)]
    struct FORMATETC {
        cf_format: u16,
        _pad: [u8; 6],
        ptd: *mut c_void,
        dw_aspect: u32,
        lindex: i32,
        tymed: u32,
    }

    // STGMEDIUM: 24 bytes on x64
    //   tymed (4) + pad (4) + hGlobal (8) + pUnkForRelease (8) = 24
    #[repr(C)]
    struct STGMEDIUM {
        tymed: u32,
        _pad: u32,
        h_global: *mut c_void,
        punk_for_release: *mut c_void,
    }

    // ── COM vtable definition ─────────────────────────────────────────────────

    #[repr(C)]
    struct DropTargetVtbl {
        query_interface:
            unsafe extern "system" fn(*mut c_void, *const GUID, *mut *mut c_void) -> i32,
        add_ref: unsafe extern "system" fn(*mut c_void) -> u32,
        release: unsafe extern "system" fn(*mut c_void) -> u32,
        drag_enter:
            unsafe extern "system" fn(*mut c_void, *mut c_void, u32, POINTL, *mut u32) -> i32,
        drag_over: unsafe extern "system" fn(*mut c_void, u32, POINTL, *mut u32) -> i32,
        drag_leave: unsafe extern "system" fn(*mut c_void) -> i32,
        drop: unsafe extern "system" fn(*mut c_void, *mut c_void, u32, POINTL, *mut u32) -> i32,
    }

    // ── COM object ────────────────────────────────────────────────────────────

    // vtbl MUST be the first field — this is the COM object layout.
    #[repr(C)]
    struct DropTarget {
        vtbl: *const DropTargetVtbl,
        ref_count: AtomicU32,
        app: ManuallyDrop<AppHandle>,
    }

    // Raw pointers prevent auto-Send/Sync, but our usage is single-threaded
    // (all OLE DnD callbacks arrive on the UI thread) so this is safe.
    unsafe impl Send for DropTarget {}
    unsafe impl Sync for DropTarget {}

    // ── IUnknown ──────────────────────────────────────────────────────────────

    unsafe extern "system" fn dt_query_interface(
        this: *mut c_void,
        riid: *const GUID,
        ppv: *mut *mut c_void,
    ) -> i32 {
        let id = &*riid;
        if guids_equal(id, &IID_IUNKNOWN) || guids_equal(id, &IID_IDROPTARGET) {
            dt_add_ref(this);
            *ppv = this;
            S_OK
        } else {
            *ppv = std::ptr::null_mut();
            E_NOINTERFACE
        }
    }

    unsafe extern "system" fn dt_add_ref(this: *mut c_void) -> u32 {
        let obj = &*(this as *const DropTarget);
        obj.ref_count.fetch_add(1, Ordering::Relaxed) + 1
    }

    unsafe extern "system" fn dt_release(this: *mut c_void) -> u32 {
        let obj = &*(this as *const DropTarget);
        let prev = obj.ref_count.fetch_sub(1, Ordering::Release);
        if prev == 1 {
            std::sync::atomic::fence(Ordering::Acquire);
            // Drop AppHandle manually before freeing the allocation.
            // ManuallyDrop<AppHandle> won't be touched by Box's destructor.
            ManuallyDrop::drop(&mut (*(this as *mut DropTarget)).app);
            drop(Box::from_raw(this as *mut DropTarget));
        }
        prev - 1
    }

    // ── IDropTarget ───────────────────────────────────────────────────────────

    unsafe extern "system" fn dt_drag_enter(
        this: *mut c_void,
        _p_data_obj: *mut c_void,
        _grf_key_state: u32,
        _pt: POINTL,
        pdw_effect: *mut u32,
    ) -> i32 {
        *pdw_effect = DROPEFFECT_COPY;
        let obj = &*(this as *const DropTarget);
        let _ = obj.app.emit("app-drag-enter", ());
        S_OK
    }

    unsafe extern "system" fn dt_drag_over(
        _this: *mut c_void,
        _grf_key_state: u32,
        _pt: POINTL,
        pdw_effect: *mut u32,
    ) -> i32 {
        *pdw_effect = DROPEFFECT_COPY;
        S_OK
    }

    unsafe extern "system" fn dt_drag_leave(this: *mut c_void) -> i32 {
        let obj = &*(this as *const DropTarget);
        let _ = obj.app.emit("app-drag-leave", ());
        S_OK
    }

    unsafe extern "system" fn dt_drop(
        this: *mut c_void,
        p_data_obj: *mut c_void,
        _grf_key_state: u32,
        _pt: POINTL,
        pdw_effect: *mut u32,
    ) -> i32 {
        *pdw_effect = DROPEFFECT_COPY;
        if p_data_obj.is_null() {
            return S_OK;
        }
        let obj = &*(this as *const DropTarget);
        let paths = read_file_paths(p_data_obj);
        let url = read_url_text(p_data_obj);
        let _ = obj.app.emit(
            "app-drop",
            serde_json::json!({ "paths": paths, "url": url }),
        );
        S_OK
    }

    fn guids_equal(a: &GUID, b: &GUID) -> bool {
        a.data1 == b.data1 && a.data2 == b.data2 && a.data3 == b.data3 && a.data4 == b.data4
    }

    // Static vtable — COM holds a *const pointer to this.
    static VTABLE: DropTargetVtbl = DropTargetVtbl {
        query_interface: dt_query_interface,
        add_ref: dt_add_ref,
        release: dt_release,
        drag_enter: dt_drag_enter,
        drag_over: dt_drag_over,
        drag_leave: dt_drag_leave,
        drop: dt_drop,
    };

    // ── IDataObject raw vtable dispatch ───────────────────────────────────────

    // IDataObject::GetData is at vtable slot 3 (after QI, AddRef, Release).
    unsafe fn idata_get_data(
        data: *mut c_void,
        fmt: *const FORMATETC,
        medium: *mut STGMEDIUM,
    ) -> i32 {
        type GetDataFn =
            unsafe extern "system" fn(*mut c_void, *const FORMATETC, *mut STGMEDIUM) -> i32;
        let vtbl: *const *const usize = *(data as *const *const *const usize);
        let fn_ptr = *vtbl.add(3);
        let get_data: GetDataFn = std::mem::transmute(fn_ptr);
        get_data(data, fmt, medium)
    }

    // ── Data readers ──────────────────────────────────────────────────────────

    unsafe fn read_file_paths(data: *mut c_void) -> Vec<String> {
        let fmt = FORMATETC {
            cf_format: CF_HDROP_FMT,
            _pad: [0u8; 6],
            ptd: std::ptr::null_mut(),
            dw_aspect: DVASPECT_CONTENT,
            lindex: -1,
            tymed: TYMED_HGLOBAL,
        };
        let mut medium: STGMEDIUM = std::mem::zeroed();

        if idata_get_data(data, &fmt, &mut medium) != S_OK {
            return vec![];
        }

        let hdrop = medium.h_global as HDROP;
        let count = DragQueryFileW(hdrop, 0xFFFF_FFFF, std::ptr::null_mut(), 0);
        let mut paths = Vec::with_capacity(count as usize);

        for i in 0..count {
            let len = DragQueryFileW(hdrop, i, std::ptr::null_mut(), 0) as usize + 1;
            let mut buf = vec![0u16; len];
            DragQueryFileW(hdrop, i, buf.as_mut_ptr(), len as u32);
            buf.truncate(len.saturating_sub(1));
            paths.push(String::from_utf16_lossy(&buf).to_string());
        }
        paths
    }

    unsafe fn read_url_text(data: *mut c_void) -> Option<String> {
        let fmt = FORMATETC {
            cf_format: CF_UNICODETEXT_FMT,
            _pad: [0u8; 6],
            ptd: std::ptr::null_mut(),
            dw_aspect: DVASPECT_CONTENT,
            lindex: -1,
            tymed: TYMED_HGLOBAL,
        };
        let mut medium: STGMEDIUM = std::mem::zeroed();

        if idata_get_data(data, &fmt, &mut medium) != S_OK {
            return None;
        }

        let hglobal = medium.h_global;
        let ptr = GlobalLock(hglobal) as *const u16;
        if ptr.is_null() {
            return None;
        }
        let chars = GlobalSize(hglobal) / 2;
        let slice = std::slice::from_raw_parts(ptr, chars);
        let end = slice.iter().position(|&c| c == 0).unwrap_or(chars);
        let text = String::from_utf16_lossy(&slice[..end]).to_string();
        GlobalUnlock(hglobal);

        let text = text.trim().to_owned();
        if text.starts_with("http") {
            Some(text)
        } else {
            None
        }
    }

    // ── HWND helpers ──────────────────────────────────────────────────────────

    struct Finder {
        class: &'static str,
        result: isize,
    }

    unsafe fn find_child_hwnd(parent: HWND, class: &'static str) -> Option<HWND> {
        let mut f = Finder { class, result: 0 };

        unsafe extern "system" fn cb(hwnd: HWND, lparam: LPARAM) -> BOOL {
            let f = &mut *(lparam as *mut Finder);
            let mut buf = [0u16; 256];
            let len = GetClassNameW(hwnd, buf.as_mut_ptr(), buf.len() as i32) as usize;
            let name = String::from_utf16_lossy(&buf[..len]);
            if name == f.class {
                f.result = hwnd;
                FALSE
            } else {
                TRUE
            }
        }

        EnumChildWindows(parent, Some(cb), &mut f as *mut Finder as LPARAM);
        if f.result == 0 {
            None
        } else {
            Some(f.result)
        }
    }

    // ── Public entry point ────────────────────────────────────────────────────

    /// Set up our custom IDropTarget on the WebView2 rendering window.
    /// `hwnd_raw` is the main window HWND as `isize` to avoid windows-rs
    /// version conflicts with Tauri's own dependency.
    pub unsafe fn setup(app: &AppHandle, hwnd_raw: isize) {
        // Ensure OLE is initialised on this thread (no-op if already done).
        OleInitialize(std::ptr::null());

        let parent: HWND = hwnd_raw;
        let hwnd = find_child_hwnd(parent, "Chrome_RenderWidgetHostHWND").unwrap_or(parent);

        // Remove WebView2's own IDropTarget.
        let _ = RevokeDragDrop(hwnd);

        // Allocate our COM object with an initial ref-count of 1.
        let target = Box::new(DropTarget {
            vtbl: &VTABLE as *const DropTargetVtbl,
            ref_count: AtomicU32::new(1),
            app: ManuallyDrop::new(app.clone()),
        });
        let raw = Box::into_raw(target);

        // RegisterDragDrop calls AddRef → ref_count becomes 2.
        let hr = RegisterDragDrop(hwnd, raw as *mut c_void as *mut _);
        if hr == S_OK {
            // Release our creation reference → ref_count returns to 1 (COM owns it).
            dt_release(raw as *mut c_void);
        } else {
            // Registration failed — free our allocation.
            ManuallyDrop::drop(&mut (*raw).app);
            drop(Box::from_raw(raw));
        }
    }
}
