// Extrait des images d'une vidéo (enregistrement d'écran d'un reel Instagram, .mov ou .mp4), sans rien installer.
// Usage : swift scripts/images-video.swift <video> <dossier-sortie> [secondes entre deux images, défaut 1]
import AVFoundation
import AppKit

let args = CommandLine.arguments
guard args.count >= 3 else { print("Usage : swift scripts/images-video.swift <video> <dossier> [pas en secondes]"); exit(1) }
let url = URL(fileURLWithPath: args[1])
let sortie = URL(fileURLWithPath: args[2])
let pas = args.count > 3 ? Double(args[3]) ?? 1 : 1
try? FileManager.default.createDirectory(at: sortie, withIntermediateDirectories: true)

let asset = AVURLAsset(url: url)
let sem = DispatchSemaphore(value: 0)
var duree = 0.0
Task { duree = (try? await asset.load(.duration).seconds) ?? 0; sem.signal() }
sem.wait()
guard duree > 0 else { print("Vidéo illisible : \(url.path)"); exit(1) }

let gen = AVAssetImageGenerator(asset: asset)
gen.appliesPreferredTrackTransform = true
gen.maximumSize = CGSize(width: 900, height: 900)
gen.requestedTimeToleranceBefore = .zero
gen.requestedTimeToleranceAfter = .zero

var t = 0.0, n = 0
while t < duree {
  let temps = CMTime(seconds: t, preferredTimescale: 600)
  if let img = try? gen.copyCGImage(at: temps, actualTime: nil) {
    let rep = NSBitmapImageRep(cgImage: img)
    if let data = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.7]) {
      n += 1
      try? data.write(to: sortie.appendingPathComponent(String(format: "img_%03d_%05.1fs.jpg", n, t)))
    }
  }
  t += pas
}
print("\(n) images extraites (\(String(format: "%.0f", duree)) s de vidéo) dans \(sortie.path)")
