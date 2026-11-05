"""Civy 3.9.5: Pin the full Home navigation while content scrolls."""
from pathlib import Path
import sys

root = Path(sys.argv[1])
file = root / "Civy/RootView.swift"
project = root / "Civy.xcodeproj/project.pbxproj"
text = file.read_text()

original = '''                        topBar
                        filterBar
                            .padding(.top, 16)
'''
assert text.count(original) == 1, "Original scrolling Home header has changed"
# Keep the old hero layout below the pinned bar while the main content
# can move continuously behind the translucent glass.
text = text.replace(original,
'''                        Color.clear
                            .frame(height: 117)
                            .accessibilityHidden(true)
''', 1)

original = '''        .sheet(item: $selected) { DetailView(media: $0).environmentObject(app) }
'''
# Other views can also present DetailView; patch only the HomeView sheet.
home_start = text.index("struct HomeView: View {")
home_end = text.index("private extension Optional", home_start)
home_chunk = text[home_start:home_end]
assert home_chunk.count(original) == 1, "Home sheet anchor changed"
home_chunk = home_chunk.replace(original,
'''        .overlay(alignment: .top) {
            pinnedHomeHeader
                .zIndex(20)
        }
''' + original, 1)
text = text[:home_start] + home_chunk + text[home_end:]

anchor = '''    private var topBar: some View {
'''
assert text.count(anchor) == 1
text = text.replace(anchor, '''    // Fixed in the viewport. The poster, rails and category content pass
    // underneath this frosted header; the AirPlay and filter controls remain
    // directly tappable even far down the Home feed.
    private var pinnedHomeHeader: some View {
        VStack(alignment: .leading, spacing: 10) {
            topBar
            filterBar
        }
        .padding(.top, 7)
        .padding(.bottom, 13)
        .frame(maxWidth: .infinity)
        .background {
            ZStack {
                Rectangle().fill(.ultraThinMaterial)
                LinearGradient(
                    stops: [
                        .init(color: Color.synBackground.opacity(0.77), location: 0),
                        .init(color: Color.synBackground.opacity(0.48), location: 0.54),
                        .init(color: Color.synBackground.opacity(0.20), location: 1)
                    ],
                    startPoint: .top, endPoint: .bottom
                )
                .allowsHitTesting(false)
            }
            .ignoresSafeArea(edges: .top)
        }
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(
                    LinearGradient(
                        colors: [.white.opacity(0.18), .white.opacity(0.035), .clear],
                        startPoint: .leading, endPoint: .trailing
                    )
                )
                .frame(height: 0.7)
                .allowsHitTesting(false)
        }
        .shadow(color: .black.opacity(0.20), radius: 14, y: 5)
        .accessibilityElement(children: .contain)
    }

''' + anchor, 1)

assert text.count('topBar\n') == 1, "Only the pinned header should show the top bar"
assert text.count('filterBar\n') == 1, "Only the pinned header should show filters"
file.write_text(text)

project_source = project.read_text()
assert project_source.count('MARKETING_VERSION = "3.9.4";') == 2
assert project_source.count('CURRENT_PROJECT_VERSION = "11";') == 2
project_source = project_source.replace('MARKETING_VERSION = "3.9.4";', 'MARKETING_VERSION = "3.9.5";')
project_source = project_source.replace('CURRENT_PROJECT_VERSION = "11";', 'CURRENT_PROJECT_VERSION = "12";')
project.write_text(project_source)
print("Civy 3.9.5: Home top navigation and filters pinned above scrolling content")
