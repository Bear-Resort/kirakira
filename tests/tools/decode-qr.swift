// Decodes every QR code in the given PNG files with Apple's CoreImage detector.
// Usage: swift decode-qr.swift a.png b.png ...   -> prints "<file>\t<base64 of decoded utf8>" per file
import Foundation
import CoreImage

let detector = CIDetector(ofType: CIDetectorTypeQRCode, context: nil,
                          options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])!
for path in CommandLine.arguments.dropFirst() {
    guard let img = CIImage(contentsOf: URL(fileURLWithPath: path)) else { print("\(path)\tLOADFAIL"); continue }
    let found = detector.features(in: img).compactMap { ($0 as? CIQRCodeFeature)?.messageString }
    if let s = found.first { print("\(path)\t\(Data(s.utf8).base64EncodedString())") }
    else { print("\(path)\tNONE") }
}
