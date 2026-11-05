"""Civy 3.9.10: install the working Clips feed and branded cinematic startup."""
from pathlib import Path
import sys

root = Path(sys.argv[1])
root_file = root / "Civy" / "RootView.swift"
project_file = root / "Civy.xcodeproj" / "project.pbxproj"
reels_file = root / "Civy" / "CivyReels.swift"

updated_reels = Path(__file__).with_name("CivyReels.swift")
assert updated_reels.exists()
reels = updated_reels.read_text()
assert reels.count("struct CivyClipsView: View {") == 1
assert "CivyTrailerClipsView" in reels and "CivyShortClipsView" in reels
assert "CivyTrailerSafari" in reels and "SFSafariViewController" in reels
assert 'if active { await play() }' in reels
reels_file.write_text(reels)

s = root_file.read_text()
state = "    @State private var tab: CivyTab = .home\n"
assert s.count(state) == 1
s = s.replace(state, state + """    @State private var showingStartup = true
    @State private var startedStartup = false
""", 1)
marker = '''        .accessibilityIdentifier("civy.nativeSlidingGlassTabBar")
'''
assert s.count(marker) == 1
s = s.replace(marker, '''        .accessibilityIdentifier("civy.nativeSlidingGlassTabBar")
        .overlay {
            if showingStartup {
                CivyCinematicStartup()
                    .transition(.opacity)
                    .zIndex(100)
                    .accessibilityIdentifier("civy.cinematicStartup")
            }
        }
        .task {
            guard !startedStartup else { return }
            startedStartup = true
            try? await Task.sleep(for: .milliseconds(2150))
            withAnimation(.easeOut(duration: 0.42)) {
                showingStartup = false
            }
        }
''', 1)

place = "private struct CivyResumeMiniBar: View {"
assert s.count(place) == 1
splash = r'''// An original Civy animation with Netflix-inspired pacing and darkness;
// no Netflix marks, audio, logos or other protected media are embedded.
private struct CivyCinematicStartup: View {
    @State private var reveal = false
    @State private var sweep = false

    private var civyLetter: some View {
        Text("C")
            .font(.system(size: 154, weight: .black, design: .rounded))
            .tracking(-8)
            .frame(width: 184, height: 194)
    }

    var body: some View {
        GeometryReader { geo in
            ZStack {
                Color.black.ignoresSafeArea()

                RadialGradient(
                    colors: [Color.synRed.opacity(reveal ? 0.27 : 0),
                             Color.synPink.opacity(reveal ? 0.08 : 0),
                             .black],
                    center: .center,
                    startRadius: 8,
                    endRadius: max(geo.size.width, geo.size.height) * 0.66
                )
                .ignoresSafeArea()

                VStack(spacing: 19) {
                    civyLetter
                        .foregroundStyle(Color.synBrandGradient)
                        .shadow(color: Color.synRed.opacity(reveal ? 0.64 : 0),
                                radius: reveal ? 37 : 0)
                        .overlay {
                            LinearGradient(
                                colors: [.clear, .white.opacity(0.03),
                                         .white.opacity(0.7), .clear],
                                startPoint: .leading, endPoint: .trailing
                            )
                            .frame(width: 35, height: 196)
                            .rotationEffect(.degrees(16))
                            .offset(x: sweep ? 170 : -180)
                            .mask {
                                civyLetter
                            }
                        }
                        .scaleEffect(reveal ? 1.0 : 0.72)
                        .opacity(reveal ? 1 : 0)

                    Text("C I V Y")
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .tracking(9)
                        .foregroundStyle(.white.opacity(reveal ? 0.78 : 0))
                        .offset(y: reveal ? 0 : 12)
                }
                .position(x: geo.size.width / 2, y: geo.size.height / 2)
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Civy is starting")
            .onAppear {
                withAnimation(.easeOut(duration: 0.78)) {
                    reveal = true
                }
                withAnimation(.easeInOut(duration: 1.08).delay(0.36)) {
                    sweep = true
                }
            }
        }
        .background(.black)
        .ignoresSafeArea()
    }
}

'''
s = s.replace(place, splash + place, 1)
assert s.count("CivyCinematicStartup") == 2
root_file.write_text(s)

p = project_file.read_text()
assert p.count('MARKETING_VERSION = "3.9.9";') == 2
assert p.count('CURRENT_PROJECT_VERSION = "16";') == 2
p = p.replace('MARKETING_VERSION = "3.9.9";', 'MARKETING_VERSION = "3.9.10";')
p = p.replace('CURRENT_PROJECT_VERSION = "16";', 'CURRENT_PROJECT_VERSION = "17";')
project_file.write_text(p)

settings = root / "Civy" / "SettingsView.swift"
t = settings.read_text()
assert t.count("Civy Beta · Version 3.9.9") == 1
settings.write_text(t.replace("Civy Beta · Version 3.9.9", "Civy Beta · Version 3.9.10", 1))
print("Civy 3.9.10: cinematic original startup plus swipeable, playable Clips and trailer modes")
