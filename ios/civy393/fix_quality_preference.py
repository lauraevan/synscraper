"""Respect user's preferred startup quality while retaining original server groups."""
from pathlib import Path
import sys

root = Path(sys.argv[1])
p = root / "Civy" / "PlayerScreen.swift"
s = p.read_text()
old = '''            sources = resolved
            if sources.isEmpty {
'''
new = '''            let preference = UserDefaults.standard.string(forKey: "civy.streaming.quality") ?? "Auto"
            if preference == "Auto" {
                sources = resolved
            } else {
                // Respect preferred resolution within each named provider (Miami,
                // Orlando, etc.), without changing the order of the server groups.
                var visited = Set<String>()
                var grouped: [StreamServer] = []
                for source in resolved {
                    let key = Self.serverKey(source)
                    guard visited.insert(key).inserted else { continue }
                    let candidates = resolved.filter { Self.serverKey($0) == key }
                    let matching = candidates.filter { Self.parsedResolution($0.quality) == preference }
                    let others = candidates.filter { Self.parsedResolution($0.quality) != preference }
                    grouped.append(contentsOf: matching + others)
                }
                sources = grouped
            }
            if sources.isEmpty {
'''
assert s.count(old) == 1
s=s.replace(old,new,1)
old = '''                    self.qualityLevels = variants
                }
'''
new = '''                    self.qualityLevels = variants
                    // Default quality applies to master HLS playlists as well.
                    // A rendition is only selected if it is actually advertised.
                    let preferred = UserDefaults.standard.string(forKey: "civy.streaming.quality") ?? "Auto"
                    if preferred != "Auto", self.selectedQuality == "Auto",
                       variants.contains(where: { $0.label == preferred }) {
                        self.chooseQuality(preferred)
                    }
                }
'''
assert s.count(old) == 1
s=s.replace(old,new,1)
p.write_text(s)
project=root/"Civy.xcodeproj"/"project.pbxproj"
x=project.read_text()
assert x.count('CURRENT_PROJECT_VERSION = "9";')==2
project.write_text(x.replace('CURRENT_PROJECT_VERSION = "9";',
                             'CURRENT_PROJECT_VERSION = "10";'))
print("Grouped Miami startup preferences and advertised HLS defaults restored")
