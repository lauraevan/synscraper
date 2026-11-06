"""Civy 3.9.11: landscape Home layout and zero PeerTube runtime paths."""
from pathlib import Path
import sys

root = Path(sys.argv[1])
file = root / "Civy" / "RootView.swift"
reels = root / "Civy" / "CivyReels.swift"
project = root / "Civy.xcodeproj" / "project.pbxproj"
settings = root / "Civy" / "SettingsView.swift"

s = file.read_text()
a = s.index("struct HomeView: View {")
b = s.index("private extension Optional", a)
home = s[a:b]
old = """struct HomeView: View {
    @EnvironmentObject private var app: AppState
"""
new = """struct HomeView: View {
    @EnvironmentObject private var app: AppState
    @Environment(\.verticalSizeClass) private var verticalSizeClass
"""
assert home.count(old) == 1
home = home.replace(old, new, 1)

# In landscape the navigation becomes a compact single toolbar with horizontal
# filter chips, rather than overlapping a fixed, tall portrait header.
old = '''    private var pinnedHomeHeader: some View {
        VStack(alignment: .leading, spacing: 10) {
            topBar
            filterBar
        }
        .padding(.top, 7)
        .padding(.bottom, 13)
        .frame(maxWidth: .infinity)'''
new = '''    private var pinnedHomeHeader: some View {
        Group {
            if verticalSizeClass == .compact {
                HStack(spacing: 4) {
                    topBar
                    filterBar
                        .frame(maxWidth: 352)
                }
                .padding(.horizontal, 7)
            } else {
                VStack(alignment: .leading, spacing: 10) {
                    topBar
                    filterBar
                }
            }
        }
        .padding(.top, verticalSizeClass == .compact ? 2 : 7)
        .padding(.bottom, verticalSizeClass == .compact ? 7 : 13)
        .frame(maxWidth: .infinity)'''
assert home.count(old) == 1
home = home.replace(old, new, 1)

old = '''                        Color.clear
                            .frame(height: 117)
                            .accessibilityHidden(true)'''
new = '''                        Color.clear
                            .frame(height: verticalSizeClass == .compact ? 72 : 117)
                            .accessibilityHidden(true)'''
assert home.count(old) == 1
home = home.replace(old, new, 1)

# Content stays at a readable width on wide devices while scrolling naturally.
old = '''                    .padding(.top, 7)
                }
                .scrollIndicators(.hidden)'''
new = '''                    .padding(.top, 7)
                    .frame(maxWidth: 1000)
                    .frame(maxWidth: .infinity)
                }
                .scrollIndicators(.hidden)'''
assert home.count(old) == 1
home = home.replace(old, new, 1)

s = s[:a] + home + s[b:]

a = s.index("private struct CivyPosterHero: View {")
b = s.index("// MARK: - Bottom destinations", a)
hero = s[a:b]
old = '''    @EnvironmentObject private var app: AppState
'''
assert hero.count(old) == 1
hero = hero.replace(old, old + '''    @Environment(\.verticalSizeClass) private var verticalSizeClass
''', 1)

old = '''    private var imageURL: URL? { TMDBImage.url(media.posterPath, size: largeArt ? "original" : "w780") ?? media.originalBackdropURL }'''
new = '''    private var imageURL: URL? {
        if verticalSizeClass == .compact {
            return media.originalBackdropURL ??
                TMDBImage.url(media.posterPath, size: "w780")
        }
        return TMDBImage.url(media.posterPath, size: largeArt ? "original" : "w780") ??
               media.originalBackdropURL
    }'''
assert hero.count(old) == 1
hero = hero.replace(old, new, 1)
old = '.aspectRatio(0.705, contentMode: .fit)'
assert hero.count(old) == 1
hero = hero.replace(old, '.aspectRatio(verticalSizeClass == .compact ? 1.85 : 0.705, contentMode: .fit)', 1)
old = '''.frame(maxWidth: geo.size.width * 0.78, maxHeight: 106)'''
assert hero.count(old) == 1
hero = hero.replace(old, '''.frame(maxWidth: geo.size.width * (verticalSizeClass == .compact ? 0.52 : 0.78),
                                   maxHeight: verticalSizeClass == .compact ? 62 : 106)''', 1)

# Keep the primary CTA clear of the tab bar, while avoiding oversized
# portrait buttons across a short landscape viewport.
old = '''.frame(height: 49)'''
assert hero.count(old) == 2
hero = hero.replace(old, '''.frame(height: verticalSizeClass == .compact ? 42 : 49)''')
s = s[:a] + hero + s[b:]
assert s.count("verticalSizeClass == .compact ? 1.85 : 0.705") == 1
assert s.count("private var pinnedHomeHeader: some View") == 1
file.write_text(s)

# Keep only TMDB-sourced movie/TV trailers. Remove every creator-video
# catalog, PeerTube domain, original-host playback request, and Shorts mode.
source = reels.read_text()
start = source.index("// Immersive clips using official TMDB-listed trailers.")
end = source.index("// Public creator-posted short films", start)
trimmed = source[start:end].replace("struct CivyTrailerClipsView: View {", "struct CivyClipsView: View {", 1)
out = "import SwiftUI\nimport SafariServices\n\n" + trimmed
assert out.count("struct CivyClipsView: View {") == 1
assert "SFSafariViewController" in out
for banned in ["PeerTube", "peertube", "sepiasearch", "CivyShortFilm",
               "CivyShortClipsView", "CivyClipsCatalog", "CivyFilmPage",
               "api/v1/search/videos", "CivyClipMode"]:
    assert banned.lower() not in out.lower(), ("Old clips dependency", banned)
assert len(out) > 7000
reels.write_text(out)

p = project.read_text()
assert p.count('MARKETING_VERSION = "3.9.10";') == 2
assert p.count('CURRENT_PROJECT_VERSION = "17";') == 2
p = p.replace('MARKETING_VERSION = "3.9.10";', 'MARKETING_VERSION = "3.9.11";')
p = p.replace('CURRENT_PROJECT_VERSION = "17";', 'CURRENT_PROJECT_VERSION = "18";')
project.write_text(p)

t = settings.read_text()
assert t.count("Civy Beta · Version 3.9.10") == 1
settings.write_text(t.replace("Civy Beta · Version 3.9.10", "Civy Beta · Version 3.9.11", 1))
print("Civy 3.9.11: landscape single-row Home toolbar, wide backdrop hero, no PeerTube")
