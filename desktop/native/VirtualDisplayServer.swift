// ═══════════════════════════════════════════════════════════════
//  VirtualDisplayServer — Creates invisible virtual monitors
//
//  Long-running process, managed by Electron. Communicates via
//  JSON-RPC over stdin/stdout. Each virtual display is a real
//  macOS display (CGVirtualDisplay, SPI) that exists only in
//  memory — no physical screen attached.
//
//  Agents get their own display, can open apps on it, capture
//  screenshots, and send input — all without touching the
//  user's physical screen.
//
//  Requires: macOS 14.0+ (Sonoma), Screen Recording permission
// ═══════════════════════════════════════════════════════════════

import Foundation
import CoreGraphics
import ImageIO
import ApplicationServices

// MARK: - CGVirtualDisplay ObjC Runtime Bridge
//
// CGVirtualDisplay exists in the CoreGraphics binary but has no
// public headers. We access it via ObjC runtime messaging, which
// is stable across macOS versions (14.0–15.x confirmed).

@objc protocol VirtualDisplayDescriptorProto {
    var queue: DispatchQueue? { get set }
    var name: String? { get set }
    var maxPixelsWide: UInt32 { get set }
    var maxPixelsHigh: UInt32 { get set }
    var sizeInMillimeters: CGSize { get set }
    var serialNum: UInt32 { get set }
    var productID: UInt32 { get set }
    var vendorID: UInt32 { get set }
}

@objc protocol VirtualDisplaySettingsProto {
    var hiDPI: Int32 { get set }
    func apply(to display: NSObject)
}

@objc protocol VirtualDisplayProto {
    var displayID: UInt32 { get }
}

func createDescriptor() -> NSObject? {
    guard let cls = NSClassFromString("CGVirtualDisplayDescriptor") as? NSObject.Type else { return nil }
    return cls.init()
}

func createSettingsObj() -> NSObject? {
    guard let cls = NSClassFromString("CGVirtualDisplaySettings") as? NSObject.Type else { return nil }
    return cls.init()
}

func createVirtualDisplay(descriptor: NSObject) -> NSObject? {
    guard let cls = NSClassFromString("CGVirtualDisplay") as? NSObject.Type else { return nil }
    let sel = NSSelectorFromString("initWithDescriptor:")
    guard cls.instancesRespond(to: sel) else { return nil }
    let obj = cls.perform(NSSelectorFromString("alloc"))?.takeUnretainedValue() as? NSObject
    return obj?.perform(sel, with: descriptor)?.takeUnretainedValue() as? NSObject
}

// MARK: - Display Storage

struct ManagedDisplay {
    let displayObj: NSObject    // Retains the CGVirtualDisplay
    let displayID: CGDirectDisplayID
    let name: String
    let width: Int
    let height: Int
}

var managedDisplays: [CGDirectDisplayID: ManagedDisplay] = [:]
let displayLock = NSLock()
var nextDisplayOffset: Int32 = 8000

// MARK: - JSON-RPC I/O

func respond(id: Int, result: [String: Any]) {
    let response: [String: Any] = ["id": id, "result": result]
    guard let data = try? JSONSerialization.data(withJSONObject: response),
          let str = String(data: data, encoding: .utf8) else { return }
    FileHandle.standardOutput.write(Data((str + "\n").utf8))
}

func respondError(id: Int, error: String) {
    let response: [String: Any] = ["id": id, "error": error]
    guard let data = try? JSONSerialization.data(withJSONObject: response),
          let str = String(data: data, encoding: .utf8) else { return }
    FileHandle.standardOutput.write(Data((str + "\n").utf8))
}

func log(_ msg: String) {
    FileHandle.standardError.write(Data("[DisplayServer] \(msg)\n".utf8))
}

// MARK: - Create Display

func handleCreateDisplay(params: [String: Any], id: Int) {
    let width = params["width"] as? Int ?? 1280
    let height = params["height"] as? Int ?? 900
    let name = params["name"] as? String ?? "Operon Agent"
    let ppi = 72.0

    guard let desc = createDescriptor() else {
        respondError(id: id, error: "Cannot instantiate CGVirtualDisplayDescriptor (macOS 14+ required)")
        return
    }

    let mmWidth = Double(width) / ppi * 25.4
    let mmHeight = Double(height) / ppi * 25.4

    desc.setValue(DispatchQueue.main, forKey: "queue")
    desc.setValue(name, forKey: "name")
    desc.setValue(UInt32(width), forKey: "maxPixelsWide")
    desc.setValue(UInt32(height), forKey: "maxPixelsHigh")
    desc.setValue(NSValue(size: CGSize(width: mmWidth, height: mmHeight)), forKey: "sizeInMillimeters")
    desc.setValue(UInt32.random(in: 1000...99999), forKey: "serialNum")
    desc.setValue(UInt32(managedDisplays.count + 1), forKey: "productID")
    desc.setValue(UInt32(0x4F50), forKey: "vendorID")

    guard let display = createVirtualDisplay(descriptor: desc) else {
        respondError(id: id, error: "CGVirtualDisplay init failed")
        return
    }

    guard let displayID = display.value(forKey: "displayID") as? UInt32, displayID != 0 else {
        respondError(id: id, error: "CGVirtualDisplay returned invalid displayID")
        return
    }

    // Create display mode and apply settings
    if let modeCls = NSClassFromString("CGVirtualDisplayMode") as? NSObject.Type,
       let settings = createSettingsObj() {
        // Set mode properties after default init (avoids multi-arg selector issues)
        let mode = modeCls.init()
        mode.setValue(UInt32(width), forKey: "width")
        mode.setValue(UInt32(height), forKey: "height")
        mode.setValue(Double(60), forKey: "refreshRate")

        settings.setValue(Int32(0), forKey: "hiDPI")
        settings.setValue([mode], forKey: "modes")

        let applySel = NSSelectorFromString("applySettings:")
        if display.responds(to: applySel) {
            display.perform(applySel, with: settings)
            log("Applied mode \(width)x\(height)@60Hz to display \(displayID)")
        }
    }

    // Position display off-screen
    displayLock.lock()
    let posX = nextDisplayOffset
    nextDisplayOffset += Int32(width) + 200

    let managed = ManagedDisplay(
        displayObj: display,
        displayID: displayID,
        name: name,
        width: width,
        height: height
    )
    managedDisplays[displayID] = managed
    displayLock.unlock()

    // Move display to known position
    var configRef: CGDisplayConfigRef?
    if CGBeginDisplayConfiguration(&configRef) == .success, let config = configRef {
        CGConfigureDisplayOrigin(config, displayID, posX, 0)
        let err = CGCompleteDisplayConfiguration(config, .forSession)
        if err != .success {
            log("Warning: display position config returned \(err.rawValue)")
        }
    }

    let bounds = CGDisplayBounds(displayID)
    log("Created display \(displayID) '\(name)': \(width)x\(height) at (\(Int(bounds.origin.x)),\(Int(bounds.origin.y)))")

    respond(id: id, result: [
        "displayId": displayID,
        "width": width,
        "height": height,
        "bounds": [
            "x": Int(bounds.origin.x),
            "y": Int(bounds.origin.y),
            "width": Int(bounds.size.width),
            "height": Int(bounds.size.height),
        ],
    ])
}

// MARK: - Destroy Display

func handleDestroyDisplay(params: [String: Any], id: Int) {
    guard let displayId = params["displayId"] as? UInt32 else {
        respondError(id: id, error: "Missing displayId"); return
    }
    displayLock.lock()
    let removed = managedDisplays.removeValue(forKey: displayId) != nil
    displayLock.unlock()
    log(removed ? "Destroyed display \(displayId)" : "Display \(displayId) not found")
    respond(id: id, result: ["success": removed])
}

// MARK: - List Displays

func handleListDisplays(id: Int) {
    displayLock.lock()
    let list = managedDisplays.values.map { d -> [String: Any] in
        let bounds = CGDisplayBounds(d.displayID)
        return [
            "displayId": d.displayID,
            "name": d.name,
            "width": d.width,
            "height": d.height,
            "bounds": [
                "x": Int(bounds.origin.x),
                "y": Int(bounds.origin.y),
                "width": Int(bounds.size.width),
                "height": Int(bounds.size.height),
            ],
        ]
    }
    displayLock.unlock()
    respond(id: id, result: ["displays": list])
}

// MARK: - Capture Display

func handleCaptureDisplay(params: [String: Any], id: Int) {
    guard let displayId = params["displayId"] as? UInt32 else {
        respondError(id: id, error: "Missing displayId"); return
    }
    let quality = params["quality"] as? Double ?? 0.5

    guard let image = CGDisplayCreateImage(displayId) else {
        respondError(id: id, error: "CGDisplayCreateImage returned nil — display may have no content yet")
        return
    }

    let data = NSMutableData()
    guard let dest = CGImageDestinationCreateWithData(data, "public.jpeg" as CFString, 1, nil) else {
        respondError(id: id, error: "Image destination creation failed"); return
    }
    CGImageDestinationAddImage(dest, image, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
    CGImageDestinationFinalize(dest)

    respond(id: id, result: [
        "base64": (data as Data).base64EncodedString(),
        "width": image.width,
        "height": image.height,
        "bytes": data.length,
    ])
}

// MARK: - Click (cursor warp: save → teleport → click → restore)

func handleClick(params: [String: Any], id: Int) {
    guard let x = params["x"] as? Double, let y = params["y"] as? Double else {
        respondError(id: id, error: "Missing x/y"); return
    }
    let count = params["count"] as? Int ?? 1
    let rightClick = (params["button"] as? String) == "right"
    let point = CGPoint(x: x, y: y)

    let savedPos = CGEvent(source: nil)?.location ?? .zero

    CGWarpMouseCursorPosition(point)
    usleep(3000)

    let downType: CGEventType = rightClick ? .rightMouseDown : .leftMouseDown
    let upType: CGEventType = rightClick ? .rightMouseUp : .leftMouseUp
    let btn: CGMouseButton = rightClick ? .right : .left

    for i in 0..<count {
        guard let down = CGEvent(mouseEventSource: nil, mouseType: downType, mouseCursorPosition: point, mouseButton: btn),
              let up = CGEvent(mouseEventSource: nil, mouseType: upType, mouseCursorPosition: point, mouseButton: btn)
        else { continue }
        down.setIntegerValueField(.mouseEventClickState, value: Int64(i + 1))
        up.setIntegerValueField(.mouseEventClickState, value: Int64(i + 1))
        down.post(tap: .cghidEventTap)
        up.post(tap: .cghidEventTap)
        if i < count - 1 { usleep(40000) }
    }

    usleep(3000)
    CGWarpMouseCursorPosition(savedPos)

    respond(id: id, result: ["success": true])
}

// MARK: - Drag

func handleDrag(params: [String: Any], id: Int) {
    guard let sx = params["startX"] as? Double, let sy = params["startY"] as? Double,
          let ex = params["endX"] as? Double, let ey = params["endY"] as? Double else {
        respondError(id: id, error: "Missing start/end coords"); return
    }
    let savedPos = CGEvent(source: nil)?.location ?? .zero
    let start = CGPoint(x: sx, y: sy)
    let end = CGPoint(x: ex, y: ey)

    CGWarpMouseCursorPosition(start)
    usleep(3000)

    CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: start, mouseButton: .left)?
        .post(tap: .cghidEventTap)
    usleep(8000)

    let steps = 10
    for i in 1...steps {
        let f = Double(i) / Double(steps)
        let pt = CGPoint(x: sx + (ex - sx) * f, y: sy + (ey - sy) * f)
        CGWarpMouseCursorPosition(pt)
        CGEvent(mouseEventSource: nil, mouseType: .leftMouseDragged, mouseCursorPosition: pt, mouseButton: .left)?
            .post(tap: .cghidEventTap)
        usleep(8000)
    }

    CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: end, mouseButton: .left)?
        .post(tap: .cghidEventTap)

    usleep(3000)
    CGWarpMouseCursorPosition(savedPos)
    respond(id: id, result: ["success": true])
}

// MARK: - Scroll

func handleScroll(params: [String: Any], id: Int) {
    guard let x = params["x"] as? Double, let y = params["y"] as? Double else {
        respondError(id: id, error: "Missing x/y"); return
    }
    let dy = Int32(params["deltaY"] as? Int ?? -3)
    let dx = Int32(params["deltaX"] as? Int ?? 0)

    let savedPos = CGEvent(source: nil)?.location ?? .zero
    let point = CGPoint(x: x, y: y)

    CGWarpMouseCursorPosition(point)
    usleep(3000)

    if let ev = CGEvent(scrollWheelEvent2Source: nil, units: .pixel,
                        wheelCount: 2, wheel1: dy, wheel2: dx, wheel3: 0) {
        ev.location = point
        ev.post(tap: .cghidEventTap)
    }

    usleep(3000)
    CGWarpMouseCursorPosition(savedPos)
    respond(id: id, result: ["success": true])
}

// MARK: - Window Management

func handleMoveWindow(params: [String: Any], id: Int) {
    guard let appName = params["appName"] as? String else {
        respondError(id: id, error: "Missing appName"); return
    }
    let x = params["x"] as? Int ?? 0
    let y = params["y"] as? Int ?? 0
    let w = params["width"] as? Int
    let h = params["height"] as? Int

    var script = "tell application \"System Events\" to tell process \"\(appName)\"\n"
    script += "    set position of window 1 to {\(x), \(y)}\n"
    if let w = w, let h = h {
        script += "    set size of window 1 to {\(w), \(h)}\n"
    }
    script += "end tell"

    runOsascript(script) { success, err in
        if success {
            respond(id: id, result: ["success": true])
        } else {
            respondError(id: id, error: "AppleScript: \(err ?? "unknown")")
        }
    }
}

func handleOpenApp(params: [String: Any], id: Int) {
    guard let appName = params["appName"] as? String else {
        respondError(id: id, error: "Missing appName"); return
    }
    let hide = params["hide"] as? Bool ?? true
    let waitMs = params["waitMs"] as? Int ?? 1500

    let task = Process()
    task.executableURL = URL(fileURLWithPath: "/usr/bin/open")
    task.arguments = hide ? ["-a", appName, "-j"] : ["-a", appName]

    do {
        try task.run()
        task.waitUntilExit()
        usleep(UInt32(waitMs * 1000))
        respond(id: id, result: ["success": true])
    } catch {
        respondError(id: id, error: "open -a failed: \(error.localizedDescription)")
    }
}

func handleGetBounds(params: [String: Any], id: Int) {
    guard let did = params["displayId"] as? UInt32 else {
        respondError(id: id, error: "Missing displayId"); return
    }
    let b = CGDisplayBounds(did)
    respond(id: id, result: ["x": Int(b.origin.x), "y": Int(b.origin.y),
                              "width": Int(b.size.width), "height": Int(b.size.height)])
}

// MARK: - Capture Window by CGWindowID

func handleCaptureWindow(params: [String: Any], id: Int) {
    guard let windowId = params["windowId"] as? Int else {
        respondError(id: id, error: "Missing windowId"); return
    }
    let quality = params["quality"] as? Double ?? 0.5

    guard let image = CGWindowListCreateImage(
        .null,
        .optionIncludingWindow,
        CGWindowID(windowId),
        [.boundsIgnoreFraming, .bestResolution]
    ) else {
        respondError(id: id, error: "CGWindowListCreateImage failed for window \(windowId)")
        return
    }

    let data = NSMutableData()
    guard let dest = CGImageDestinationCreateWithData(data, "public.jpeg" as CFString, 1, nil) else {
        respondError(id: id, error: "Image destination creation failed"); return
    }
    CGImageDestinationAddImage(dest, image, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
    CGImageDestinationFinalize(dest)

    respond(id: id, result: [
        "base64": (data as Data).base64EncodedString(),
        "width": image.width,
        "height": image.height,
        "bytes": data.length,
    ])
}

// MARK: - List Windows for an App (optionally filtered by display)

func handleListAppWindows(params: [String: Any], id: Int) {
    guard let appName = params["appName"] as? String else {
        respondError(id: id, error: "Missing appName"); return
    }
    let filterDisplayId = params["displayId"] as? UInt32

    guard let windowList = CGWindowListCopyWindowInfo(
        [.optionAll, .excludeDesktopElements],
        kCGNullWindowID
    ) as? [[String: Any]] else {
        respondError(id: id, error: "CGWindowListCopyWindowInfo failed"); return
    }

    var result: [[String: Any]] = []
    let appLower = appName.lowercased()

    for w in windowList {
        guard let owner = w[kCGWindowOwnerName as String] as? String,
              owner.lowercased().contains(appLower),
              let wid = w[kCGWindowNumber as String] as? Int,
              let layer = w[kCGWindowLayer as String] as? Int,
              layer == 0, wid > 0 else { continue }

        let title = w[kCGWindowName as String] as? String ?? ""
        let bounds = w[kCGWindowBounds as String] as? [String: Any] ?? [:]
        let bx = bounds["X"] as? Double ?? 0
        let by = bounds["Y"] as? Double ?? 0
        let bw = bounds["Width"] as? Double ?? 0
        let bh = bounds["Height"] as? Double ?? 0

        if let did = filterDisplayId {
            let db = CGDisplayBounds(did)
            let center = CGPoint(x: bx + bw / 2, y: by + bh / 2)
            if !db.contains(center) { continue }
        }

        result.append([
            "windowId": wid,
            "title": title,
            "bounds": ["x": Int(bx), "y": Int(by), "width": Int(bw), "height": Int(bh)],
            "pid": w[kCGWindowOwnerPID as String] as? Int ?? 0,
        ])
    }

    respond(id: id, result: ["windows": result])
}

// MARK: - Raise Window (AXRaise — makes it key window within its app)

func handleRaiseWindow(params: [String: Any], id: Int) {
    guard let windowId = params["windowId"] as? Int else {
        respondError(id: id, error: "Missing windowId"); return
    }

    guard let windowList = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as? [[String: Any]] else {
        respondError(id: id, error: "Cannot list windows"); return
    }

    var targetPid: pid_t = 0
    for w in windowList {
        if (w[kCGWindowNumber as String] as? Int) == windowId {
            targetPid = pid_t(w[kCGWindowOwnerPID as String] as? Int ?? 0)
            break
        }
    }
    if targetPid == 0 {
        respondError(id: id, error: "Window \(windowId) not found"); return
    }

    let appRef = AXUIElementCreateApplication(targetPid)
    var windowsRef: CFTypeRef?
    let err = AXUIElementCopyAttributeValue(appRef, kAXWindowsAttribute as CFString, &windowsRef)

    guard err == .success, let axWindows = windowsRef as? [AXUIElement] else {
        respondError(id: id, error: "Cannot get AX windows for PID \(targetPid)"); return
    }

    if let firstWindow = axWindows.first {
        AXUIElementPerformAction(firstWindow, kAXRaiseAction as CFString)
        respond(id: id, result: ["success": true])
    } else {
        respondError(id: id, error: "No AX windows found for PID \(targetPid)")
    }
}

// MARK: - Type Text to a Specific Process (AppleScript targeted)

func handleTypeToProcess(params: [String: Any], id: Int) {
    guard let appName = params["appName"] as? String,
          let text = params["text"] as? String else {
        respondError(id: id, error: "Missing appName or text"); return
    }

    let escaped = text.replacingOccurrences(of: "\\", with: "\\\\")
                      .replacingOccurrences(of: "\"", with: "\\\"")
    let script = "tell application \"System Events\" to tell process \"\(appName)\" to keystroke \"\(escaped)\""
    runOsascript(script) { success, err in
        if success {
            respond(id: id, result: ["success": true])
        } else {
            respondError(id: id, error: "keystroke failed: \(err ?? "unknown")")
        }
    }
}

// MARK: - Key Combo to Process (AppleScript, no subprocess from TS needed)

func handleKeyToProcess(params: [String: Any], id: Int) {
    guard let appName = params["appName"] as? String,
          let key = params["key"] as? String else {
        respondError(id: id, error: "Missing appName or key"); return
    }
    let modifiers = params["modifiers"] as? [String] ?? []

    if modifiers.isEmpty {
        // Special key (Return, Tab, Escape, arrows, etc.)
        let keyCodes: [String: Int] = [
            "return": 36, "enter": 36, "tab": 48,
            "escape": 53, "esc": 53, "delete": 51, "backspace": 51,
            "fwd-delete": 117, "forwarddelete": 117, "space": 49,
            "up": 126, "arrow-up": 126, "down": 125, "arrow-down": 125,
            "left": 123, "arrow-left": 123, "right": 124, "arrow-right": 124,
            "home": 115, "end": 119, "page_up": 116, "pageup": 116,
            "page_down": 121, "pagedown": 121,
            "f1": 122, "f2": 120, "f3": 99, "f4": 118,
            "f5": 96, "f6": 97, "f7": 98, "f8": 100,
            "f9": 101, "f10": 109, "f11": 103, "f12": 111,
        ]

        let lower = key.lowercased()
        if let code = keyCodes[lower] {
            let script = "tell application \"System Events\" to tell process \"\(appName)\" to key code \(code)"
            runOsascript(script) { success, err in
                success ? respond(id: id, result: ["success": true])
                        : respondError(id: id, error: "key failed: \(err ?? "unknown")")
            }
        } else {
            let escaped = key.replacingOccurrences(of: "\\", with: "\\\\")
                             .replacingOccurrences(of: "\"", with: "\\\"")
            let script = "tell application \"System Events\" to tell process \"\(appName)\" to keystroke \"\(escaped)\""
            runOsascript(script) { success, err in
                success ? respond(id: id, result: ["success": true])
                        : respondError(id: id, error: "keystroke failed: \(err ?? "unknown")")
            }
        }
    } else {
        // Key combo with modifiers
        let modStr = modifiers.map { m -> String in
            let lower = m.lowercased()
            if ["cmd", "command", "super", "meta"].contains(lower) { return "command down" }
            if ["ctrl", "control"].contains(lower) { return "control down" }
            if ["alt", "option"].contains(lower) { return "option down" }
            if lower == "shift" { return "shift down" }
            return "\(lower) down"
        }.joined(separator: ", ")

        let keyCodes: [String: Int] = [
            "return": 36, "enter": 36, "tab": 48, "escape": 53,
            "delete": 51, "space": 49,
            "up": 126, "down": 125, "left": 123, "right": 124,
            "a": 0, "b": 11, "c": 8, "d": 2, "e": 14, "f": 3,
            "g": 5, "h": 4, "i": 34, "j": 38, "k": 40, "l": 37,
            "m": 46, "n": 45, "o": 31, "p": 35, "q": 12, "r": 15,
            "s": 1, "t": 17, "u": 32, "v": 9, "w": 13, "x": 7,
            "y": 16, "z": 6,
        ]

        let lower = key.lowercased()
        if let code = keyCodes[lower] {
            let script = "tell application \"System Events\" to tell process \"\(appName)\" to key code \(code) using {\(modStr)}"
            runOsascript(script) { success, err in
                success ? respond(id: id, result: ["success": true])
                        : respondError(id: id, error: "key combo failed: \(err ?? "unknown")")
            }
        } else {
            let escaped = key.replacingOccurrences(of: "\\", with: "\\\\")
                             .replacingOccurrences(of: "\"", with: "\\\"")
            let script = "tell application \"System Events\" to tell process \"\(appName)\" to keystroke \"\(escaped)\" using {\(modStr)}"
            runOsascript(script) { success, err in
                success ? respond(id: id, result: ["success": true])
                        : respondError(id: id, error: "key combo failed: \(err ?? "unknown")")
            }
        }
    }
}

// MARK: - Move Window by AX API (no Python subprocess needed)

func handleMoveWindowById(params: [String: Any], id: Int) {
    guard let windowId = params["windowId"] as? Int else {
        respondError(id: id, error: "Missing windowId"); return
    }
    let x = params["x"] as? Int ?? 0
    let y = params["y"] as? Int ?? 0
    let width = params["width"] as? Int
    let height = params["height"] as? Int

    guard let windowList = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as? [[String: Any]] else {
        respondError(id: id, error: "Cannot list windows"); return
    }

    var targetPid: pid_t = 0
    for w in windowList {
        if (w[kCGWindowNumber as String] as? Int) == windowId {
            targetPid = pid_t(w[kCGWindowOwnerPID as String] as? Int ?? 0)
            break
        }
    }
    if targetPid == 0 {
        respondError(id: id, error: "Window \(windowId) not found"); return
    }

    let appRef = AXUIElementCreateApplication(targetPid)
    var windowsRef: CFTypeRef?
    let err = AXUIElementCopyAttributeValue(appRef, kAXWindowsAttribute as CFString, &windowsRef)

    guard err == .success, let axWindows = windowsRef as? [AXUIElement], let axWin = axWindows.first else {
        respondError(id: id, error: "Cannot get AX windows for PID \(targetPid)"); return
    }

    var posVal: CFTypeRef? = AXValueCreate(.cgPoint, [CGPoint(x: CGFloat(x), y: CGFloat(y))] as CFArray)
    // Use proper AXValue creation for position
    var point = CGPoint(x: CGFloat(x), y: CGFloat(y))
    posVal = AXValueCreate(.cgPoint, &point)
    if let pv = posVal {
        AXUIElementSetAttributeValue(axWin, kAXPositionAttribute as CFString, pv)
    }

    if let w = width, let h = height {
        var size = CGSize(width: CGFloat(w), height: CGFloat(h))
        if let sv = AXValueCreate(.cgSize, &size) {
            AXUIElementSetAttributeValue(axWin, kAXSizeAttribute as CFString, sv)
        }
    }

    respond(id: id, result: ["success": true])
}

// MARK: - Open App + Create New Window (returns new window ID)

func handleOpenAppWindow(params: [String: Any], id: Int) {
    guard let appName = params["appName"] as? String else {
        respondError(id: id, error: "Missing appName"); return
    }
    let displayId = params["displayId"] as? UInt32

    // Snapshot windows before
    let windowsBefore = getAppWindowIds(appName)

    // Open app
    let task = Process()
    task.executableURL = URL(fileURLWithPath: "/usr/bin/open")
    task.arguments = ["-a", appName]
    do {
        try task.run()
        task.waitUntilExit()
    } catch {
        respondError(id: id, error: "open -a failed: \(error.localizedDescription)"); return
    }

    // Wait for app to launch (poll for new window, max 3 seconds)
    var newWindowId: Int? = nil
    var newTitle = ""
    for _ in 0..<30 {
        usleep(100_000) // 100ms
        let windowsAfter = getAppWindowIds(appName)
        for w in windowsAfter {
            if !windowsBefore.contains(where: { $0.0 == w.0 }) {
                newWindowId = w.0
                newTitle = w.1
                break
            }
        }
        if newWindowId != nil { break }
        if windowsAfter.count > 0 && windowsBefore.isEmpty {
            newWindowId = windowsAfter[0].0
            newTitle = windowsAfter[0].1
            break
        }
    }

    // Try Cmd+N for a new window
    if windowsBefore.count > 0 || newWindowId != nil {
        let beforeNewWindow = getAppWindowIds(appName)
        let cmdNScript = "tell application \"System Events\" to tell process \"\(appName)\" to keystroke \"n\" using command down"
        runOsascript(cmdNScript) { _, _ in }
        usleep(500_000) // 500ms

        let afterNewWindow = getAppWindowIds(appName)
        for w in afterNewWindow {
            if !beforeNewWindow.contains(where: { $0.0 == w.0 }) {
                newWindowId = w.0
                newTitle = w.1
                break
            }
        }
    }

    guard let wid = newWindowId else {
        // Fall back to first window
        let allWindows = getAppWindowIds(appName)
        if let first = allWindows.first {
            respondWithWindow(id: id, windowId: first.0, title: first.1, displayId: displayId, appName: appName)
        } else {
            respondError(id: id, error: "No window found for \(appName)")
        }
        return
    }

    respondWithWindow(id: id, windowId: wid, title: newTitle, displayId: displayId, appName: appName)
}

private func respondWithWindow(id: Int, windowId: Int, title: String, displayId: UInt32?, appName: String) {
    // Move to virtual display if requested
    if let did = displayId {
        let db = CGDisplayBounds(did)
        // Use the move_window_by_id logic inline
        if let windowList = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as? [[String: Any]] {
            var targetPid: pid_t = 0
            for w in windowList {
                if (w[kCGWindowNumber as String] as? Int) == windowId {
                    targetPid = pid_t(w[kCGWindowOwnerPID as String] as? Int ?? 0)
                    break
                }
            }
            if targetPid > 0 {
                let appRef = AXUIElementCreateApplication(targetPid)
                var windowsRef: CFTypeRef?
                let err = AXUIElementCopyAttributeValue(appRef, kAXWindowsAttribute as CFString, &windowsRef)
                if err == .success, let axWindows = windowsRef as? [AXUIElement], let axWin = axWindows.first {
                    var point = CGPoint(x: db.origin.x, y: db.origin.y)
                    if let pv = AXValueCreate(.cgPoint, &point) {
                        AXUIElementSetAttributeValue(axWin, kAXPositionAttribute as CFString, pv)
                    }
                    var size = CGSize(width: db.size.width, height: db.size.height)
                    if let sv = AXValueCreate(.cgSize, &size) {
                        AXUIElementSetAttributeValue(axWin, kAXSizeAttribute as CFString, sv)
                    }
                }
            }
        }
    }

    respond(id: id, result: [
        "windowId": windowId,
        "title": title,
        "appName": appName,
    ])
}

private func getAppWindowIds(_ appName: String) -> [(Int, String)] {
    guard let windowList = CGWindowListCopyWindowInfo(
        [.optionAll, .excludeDesktopElements], kCGNullWindowID
    ) as? [[String: Any]] else { return [] }

    let appLower = appName.lowercased()
    var result: [(Int, String)] = []
    for w in windowList {
        guard let owner = w[kCGWindowOwnerName as String] as? String,
              owner.lowercased().contains(appLower),
              let wid = w[kCGWindowNumber as String] as? Int,
              let layer = w[kCGWindowLayer as String] as? Int,
              layer == 0, wid > 0 else { continue }
        result.append((wid, w[kCGWindowName as String] as? String ?? ""))
    }
    return result
}

// MARK: - Clipboard (named NSPasteboard for per-agent isolation)

func handleClipboardWrite(params: [String: Any], id: Int) {
    guard let name = params["name"] as? String,
          let text = params["text"] as? String else {
        respondError(id: id, error: "Missing name or text"); return
    }
    let pb = NSPasteboard(name: NSPasteboard.Name(name))
    pb.clearContents()
    pb.setString(text, forType: .string)
    respond(id: id, result: ["success": true])
}

func handleClipboardRead(params: [String: Any], id: Int) {
    guard let name = params["name"] as? String else {
        respondError(id: id, error: "Missing name"); return
    }
    let pb = NSPasteboard(name: NSPasteboard.Name(name))
    let text = pb.string(forType: .string) ?? ""
    respond(id: id, result: ["text": text])
}

// MARK: - Helpers

func runOsascript(_ script: String, completion: @escaping (Bool, String?) -> Void) {
    let task = Process()
    task.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
    task.arguments = ["-e", script]
    let pipe = Pipe()
    task.standardOutput = pipe
    task.standardError = pipe
    do {
        try task.run()
        task.waitUntilExit()
        if task.terminationStatus == 0 {
            completion(true, nil)
        } else {
            let errData = pipe.fileHandleForReading.readDataToEndOfFile()
            completion(false, String(data: errData, encoding: .utf8))
        }
    } catch {
        completion(false, error.localizedDescription)
    }
}

// MARK: - Request Router

func processRequest(_ line: String) {
    guard let data = line.data(using: .utf8),
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let reqId = json["id"] as? Int,
          let method = json["method"] as? String else { return }

    let params = json["params"] as? [String: Any] ?? [:]

    switch method {
    case "create_display":    handleCreateDisplay(params: params, id: reqId)
    case "destroy_display":   handleDestroyDisplay(params: params, id: reqId)
    case "list_displays":     handleListDisplays(id: reqId)
    case "capture_display":   handleCaptureDisplay(params: params, id: reqId)
    case "capture_window":    handleCaptureWindow(params: params, id: reqId)
    case "list_app_windows":  handleListAppWindows(params: params, id: reqId)
    case "raise_window":      handleRaiseWindow(params: params, id: reqId)
    case "type_to_process":   handleTypeToProcess(params: params, id: reqId)
    case "key_to_process":    handleKeyToProcess(params: params, id: reqId)
    case "move_window_by_id": handleMoveWindowById(params: params, id: reqId)
    case "open_app_window":   handleOpenAppWindow(params: params, id: reqId)
    case "clipboard_write":   handleClipboardWrite(params: params, id: reqId)
    case "clipboard_read":    handleClipboardRead(params: params, id: reqId)
    case "click":             handleClick(params: params, id: reqId)
    case "drag":              handleDrag(params: params, id: reqId)
    case "scroll":            handleScroll(params: params, id: reqId)
    case "move_window":       handleMoveWindow(params: params, id: reqId)
    case "open_app":          handleOpenApp(params: params, id: reqId)
    case "get_bounds":        handleGetBounds(params: params, id: reqId)
    case "ping":              respond(id: reqId, result: ["pong": true, "displays": managedDisplays.count])
    default:                  respondError(id: reqId, error: "Unknown method: \(method)")
    }
}

// MARK: - Main

log("Starting (macOS \(ProcessInfo.processInfo.operatingSystemVersionString))")

DispatchQueue.global(qos: .userInitiated).async {
    while let line = readLine() {
        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { continue }
        DispatchQueue.main.async { processRequest(trimmed) }
    }
    log("stdin closed, exiting")
    exit(0)
}

RunLoop.main.run()
