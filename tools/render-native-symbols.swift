import AppKit
import CoreText
import Foundation

// Render only the glyphs referenced by the pinned source documents. Font files
// stay on the macOS runner. Reject missing-glyph boxes rather than publishing them.
let arguments = CommandLine.arguments
if arguments.count != 4 { fatalError("Usage: render-native-symbols requests.json output-dir manifest.json") }
let requests = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: arguments[1]))) as! [String]
let directory = URL(fileURLWithPath: arguments[2], isDirectory: true)
try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
var manifest: [String: Any] = [:]
var missing: [String] = []
let weights: [(String, NSFont.Weight)] = [("400", .regular), ("600", .semibold)]
for code in requests.sorted() {
    guard let number = UInt32(code, radix: 16), let scalar = Unicode.Scalar(number) else { continue }
    for (weight, trait) in weights {
        let requestedFont = NSFont(name: weight == "600" ? "SFPro-Semibold" : "SFPro-Regular", size: 96) ?? NSFont.systemFont(ofSize: 96, weight: trait)
        let attributes: [NSAttributedString.Key: Any] = [.font: requestedFont, .foregroundColor: NSColor.white]
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: String(scalar), attributes: attributes))
        let runs = CTLineGetGlyphRuns(line) as! [CTRun]
        var valid = !runs.isEmpty
        var fonts = Set<String>()
        for run in runs {
            let count = CTRunGetGlyphCount(run)
            var glyphs = [CGGlyph](repeating: 0, count: count)
            CTRunGetGlyphs(run, CFRange(location: 0, length: 0), &glyphs)
            if count == 0 || glyphs.contains(0) { valid = false }
            let runAttributes = CTRunGetAttributes(run) as NSDictionary
            if let font = runAttributes[kCTFontAttributeName] { fonts.insert(CTFontCopyPostScriptName(font as! CTFont) as String) }
        }
        let bounds = CTLineGetBoundsWithOptions(line, [.useGlyphPathBounds])
        if !valid || bounds.isEmpty || !bounds.width.isFinite || !bounds.height.isFinite {
            missing.append(code + ":" + weight); continue
        }
        let pixels = 192
        guard let context = CGContext(data: nil, width: pixels, height: pixels, bitsPerComponent: 8, bytesPerRow: pixels * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { fatalError("Bitmap context unavailable") }
        context.setShouldAntialias(true)
        let scale = 184 / max(bounds.width, bounds.height)
        context.translateBy(x: (CGFloat(pixels) - bounds.width * scale) / 2, y: (CGFloat(pixels) - bounds.height * scale) / 2)
        context.scaleBy(x: scale, y: scale)
        context.translateBy(x: -bounds.minX, y: -bounds.minY)
        context.textPosition = .zero
        CTLineDraw(line, context)
        guard let image = context.makeImage(), let png = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]) else { fatalError("PNG encoding failed") }
        let name = "symbol-" + code.lowercased() + "-" + weight + ".png"
        try png.write(to: directory.appendingPathComponent(name))
        manifest[code + ":" + weight] = ["url": "artwork/" + name, "fonts": fonts.sorted(), "bounds": [bounds.minX, bounds.minY, bounds.width, bounds.height], "size": pixels]
    }
}
let result: [String: Any] = ["schema": 1, "renderer": "CoreText", "operatingSystem": ProcessInfo.processInfo.operatingSystemVersionString, "glyphs": manifest, "missing": missing]
try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys]).write(to: URL(fileURLWithPath: arguments[3]))
print("Rendered \(manifest.count) glyph images; missing \(missing.count): \(missing.joined(separator: ", "))")
