from pathlib import Path
import re, sys
root = Path(sys.argv[1]); app = root/'Civy'

def edit(name, fn):
    path=app/name
    src=path.read_text()
    out=fn(src)
    assert out!=src, name+' was not modified'
    path.write_text(out)


def root_changes(s):
    s=s.replace('@State private var tab: CivyTab = .home','@State private var tab: CivyTab = .home\n    @StateObject private var viewers = CivyViewerStore()',1)
    s=s.replace('''        .fontDesign(.default)
        .fullScreenCover(item:''','''        .fontDesign(.default)
        .environmentObject(viewers)
        .fullScreenCover(isPresented: $viewers.choosing) {
            CivyWhoIsWatching()
                .environmentObject(viewers)
                .environmentObject(app)
        }
        .fullScreenCover(item:''',1)
    s=s.replace('''    @State private var showDownloads = false
''','',1)
    s=s.replace('''        .sheet(isPresented: $showDownloads) { CivyDownloadsView().environmentObject(app) }
''','',1)
    s=re.sub(r'''            Button \{ showDownloads = true \} label: \{\n                Image\(systemName: "arrow.down.to.line"\).*?\n            \}\n            \.accessibilityLabel\("Downloads"\)\n''','',s,count=1,flags=re.S)
    # My Civy profile: switcher replaces offline library.
    s=s.replace('''    @AppStorage("civy.profile.icon") private var profileIcon = "person.fill"''','''    @AppStorage("civy.profile.icon") private var profileIcon = "person.fill"
    @EnvironmentObject private var viewers: CivyViewerStore''',1)
    s=s.replace('''    @State private var showOffline = false
''','',1)
    s=s.replace('''                        Button { showOffline = true } label: { profileAction("Offline Library", "arrow.down.circle.fill", "Import videos and watch without internet") }
''','''                        Button { viewers.choosing = true } label: {
                            profileAction("Switch Profile", "person.2.crop.square.stack.fill", "Choose who's watching or add someone")
                        }
''',1)
    s=s.replace('''            .sheet(isPresented: $showOffline) { CivyOfflineLibraryView() }
''','',1)
    s=re.sub(r'''struct CivyDownloadsView: View \{\n    var body: some View \{ CivyOfflineLibraryView\(\) \}\n\}\n\n''','',s,count=1)
    # More expressive translucent dock inspired by Apple's system material.
    s=s.replace('''                    .glassEffectID("selected-civy-tab", in: selectionGlass)''','''                    .glassEffectID("selected-civy-tab", in: selectionGlass)''')
    s=s.replace('''                                    .fill(Color.white.opacity(glass ? 0.10 : 0.16))''','''                                    .fill(Color.white.opacity(glass ? 0.20 : 0.16))''',1)
    s=s.replace('''.glassEffect(glass ? .regular.tint(Color.white.opacity(0.12)).interactive() : .identity, in: Capsule())''','''.glassEffect(glass ? .regular.tint(Color.white.opacity(0.24)).interactive() : .identity, in: Capsule())''',1)
    s=s.replace('''.glassEffect(glass ? .regular.tint(Color.black.opacity(0.09)).interactive() : .identity, in: Capsule())''','''.glassEffect(glass ? .regular.tint(Color.white.opacity(0.11)).interactive() : .identity, in: Capsule())''',1)
    s=s.replace('''.strokeBorder(Color.white.opacity(glass ? 0.18 : 0.12), lineWidth: 0.7)''','''.strokeBorder(Color.white.opacity(glass ? 0.35 : 0.12), lineWidth: 0.8)''',1)
    s=s.replace('''.shadow(color: Color.black.opacity(0.48), radius: 22, y: 11)''','''.shadow(color: Color.black.opacity(0.55), radius: 24, y: 12)
            .shadow(color: Color.white.opacity(0.09), radius: 3, y: -1)''',1)
    # Keep active account avatar on My Civy for real profile identity.
    s=s.replace('''                            Image(systemName: profileIcon)
                                .font(.system(size: 27, weight: .medium))
                                .frame(width: 70, height: 70)
                                .background(Color.synAccent.gradient, in: RoundedRectangle(cornerRadius: 22))''','''                            CivyViewerAvatar(viewer: viewers.active ?? CivyViewer(id: "primary", name: profileName, symbol: profileIcon, tintIndex: 0), size: 70)''',1)
    return s
edit('RootView.swift', root_changes)


def search_changes(s):
    s=s.replace('''    @State private var showDownloads = false
''','',1)
    s=re.sub(r'''                        Button \{ showDownloads = true \} label: \{\n                            Image\(systemName: "arrow.down.to.line"\).*?\n                        \}\n                        \.accessibilityLabel\("Downloads"\)\n''','',s,count=1,flags=re.S)
    s=s.replace('''            .sheet(isPresented: $showDownloads) { CivyDownloadsView().environmentObject(app) }
''','',1)
    return s
edit('SearchView.swift',search_changes)


def app_changes(s):
    s=s.replace('''    @Published var playbackRequest: PlaybackRequest?''','''    @Published var playbackRequest: PlaybackRequest?
    private(set) var activeProfileID: String?''',1)
    # Init keeps legacy primary data, loads selected saved profile if known.
    s=s.replace('''        favorites = Self.load("civy.favorites", as: [Media].self) ?? []
        history = Self.load("civy.history", as: [WatchRecord].self) ?? []''','''        activeProfileID = UserDefaults.standard.string(forKey: "civy.selectedViewer")
        let profile = activeProfileID ?? "primary"
        favorites = Self.load("civy.profile.\(profile).favorites", as: [Media].self)
            ?? (profile == "primary" ? Self.load("civy.favorites", as: [Media].self) : nil) ?? []
        history = Self.load("civy.profile.\(profile).history", as: [WatchRecord].self)
            ?? (profile == "primary" ? Self.load("civy.history", as: [WatchRecord].self) : nil) ?? []''',1)
    s=s.replace('''    func isFavorite(_ media: Media) -> Bool''','''    func activateProfile(_ id: String) {
        activeProfileID = id
        let prefix = "civy.profile.\(id)"
        favorites = Self.load("\(prefix).favorites", as: [Media].self)
            ?? (id == "primary" ? Self.load("civy.favorites", as: [Media].self) : nil) ?? []
        history = Self.load("\(prefix).history", as: [WatchRecord].self)
            ?? (id == "primary" ? Self.load("civy.history", as: [WatchRecord].self) : nil) ?? []
    }

    func isFavorite(_ media: Media) -> Bool''',1)
    s=s.replace('''        persist(favorites, key: "civy.favorites")''','''        persist(favorites, key: "civy.profile.\(activeProfileID ?? "primary").favorites")''')
    s=s.replace('''        persist(history, key: "civy.history")''','''        persist(history, key: "civy.profile.\(activeProfileID ?? "primary").history")''')
    return s
edit('AppState.swift',app_changes)


def settings_changes(s):
    # Don't let Settings mutate only the old profile name while ignoring new multi-profile store.
    start=s.index('private struct ProfileSettings: View {')
    end=s.index('private struct AppearanceSettings: View {',start)
    new='''private struct ProfileSettings: View {
    @EnvironmentObject private var viewers: CivyViewerStore
    @Environment(\\.dismiss) private var dismiss
    var body: some View {
        List {
            Section("Your profile") {
                HStack(spacing: 16) {
                    if let active = viewers.active {
                        CivyViewerAvatar(viewer: active, size: 62)
                    }
                    VStack(alignment: .leading, spacing: 5) {
                        Text(viewers.active?.name ?? "Civy Viewer").font(.headline)
                        Text("Watch history and My List are saved separately for each profile.")
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                }.padding(.vertical, 10)
                Button("Choose or manage profiles") {
                    dismiss()
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { viewers.choosing = true }
                }
            }
            Section { Text("Profiles are stored on this iPhone. This is not a cloud account or subscription.")
                    .font(.footnote).foregroundStyle(.secondary) }
        }
        .navigationTitle("Profiles")
    }
}

'''
    return s[:start]+new+s[end:]
edit('SettingsView.swift',settings_changes)

# Remove downloader/source imports and exclude from Xcode target (artwork cache remains).
(root/'Civy'/'OfflineLibrary.swift').unlink(missing_ok=True)
project=root/'Civy.xcodeproj/project.pbxproj'
p=project.read_text()
p='\n'.join(line for line in p.split('\n') if not line.lstrip().startswith('B51F8A63D7B14C72AB9A3E20 /* PBXFileReference */') and not line.lstrip().startswith('B51F8A63D7B14C72AB9A3E21 /* PBXBuildFile */'))
p=p.replace('B51F8A63D7B14C72AB9A3E20, ', '').replace('B51F8A63D7B14C72AB9A3E21, ', '')
# Add new profile source to Xcode target via own IDs.
refid='C1F0C1F0C1F0C1F0C1F0C1F1'; buildid='C1F0C1F0C1F0C1F0C1F0C1F2'
needle='\t\t9F6CFF8906F1A9A5F87CD18B /* PBXFileReference */ = {'
assert needle in p
p=p.replace(needle, f'\t\t{refid} /* PBXFileReference */ = {{ isa = PBXFileReference; lastKnownFileType = "sourcecode.swift"; path = "CivyProfiles.swift"; sourceTree = "<group>"; }};\n\t\t{buildid} /* PBXBuildFile */ = {{ isa = PBXBuildFile; fileRef = "{refid}"; }};\n'+needle,1)
p=p.replace('B51F8A63D7B14C72AB9A3E22, 4DB5DC12B30043BAA94F7C00',f'B51F8A63D7B14C72AB9A3E22, {refid}, 4DB5DC12B30043BAA94F7C00',1)
p=p.replace('B51F8A63D7B14C72AB9A3E23, 5B387801BB68F29512AE4894',f'B51F8A63D7B14C72AB9A3E23, {buildid}, 5B387801BB68F29512AE4894',1)
p=p.replace('MARKETING_VERSION = "3.8.0"','MARKETING_VERSION = "3.9.0"').replace('CURRENT_PROJECT_VERSION = "7"','CURRENT_PROJECT_VERSION = "8"')
project.write_text(p)
print('Civy 3.9 profile and download removal complete')
