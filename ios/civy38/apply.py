from pathlib import Path
import sys

root = Path(sys.argv[1])
model = root / 'Civy/Models.swift'
s = model.read_text()
assert 'struct HomeResponse: Decodable' in s
model.write_text(s.replace('struct HomeResponse: Decodable', 'struct HomeResponse: Codable', 1))

app = root / 'Civy/AppState.swift'
s = app.read_text()
a = '        history = Self.load("civy.history", as: [WatchRecord].self) ?? []'
assert a in s
s = s.replace(a, a + '''
        home = Self.load("civy.home.lastGood", as: HomeResponse.self)
        curated = Self.load("civy.curated.lastGood", as: [String: [Media]].self) ?? [:]
        URLCache.shared = URLCache(memoryCapacity: 48 * 1024 * 1024,
                                  diskCapacity: 192 * 1024 * 1024,
                                  diskPath: "CivyHTTP")
'''.rstrip(), 1)
a = '''            home = try await api.home()
            homeError = nil'''
assert a in s
s = s.replace(a, '''            let response = try await api.home()
            home = response
            persist(response, key: "civy.home.lastGood")
            homeError = nil
            let prewarm = Array(response.trending.prefix(15)) + Array(response.popularMovies.prefix(12))
            Task.detached(priority: .utility) {
                let urls = prewarm.flatMap { [$0.posterURL, $0.backdropURL] }.compactMap { $0 }
                await CivyArtworkStore.prefetch(urls)
            }''', 1)
s = s.replace('            homeError = error.localizedDescription',
              '            homeError = home == nil ? error.localizedDescription : "Offline. Showing the last saved catalog."', 1)
s = s.replace('guard !isLoadingCurated && curated.isEmpty else { return }',
              'guard !isLoadingCurated else { return }', 1)
a = '''                curated[title] = titles
            }
        }
    }'''
assert a in s
s = s.replace(a, '''                curated[title] = titles
            }
        }
        if !curated.isEmpty { persist(curated, key: "civy.curated.lastGood") }
    }''', 1)
app.write_text(s)

rootview = root / 'Civy/RootView.swift'
s = rootview.read_text()
a = '''    @State private var showSettings = false
    @State private var selected: Media?'''
assert a in s
s = s.replace(a, '''    @State private var showSettings = false
    @State private var showOffline = false
    @State private var selected: Media?''', 1)
a = '''                        Button { showSettings = true } label: { profileAction("App Settings", "slider.horizontal.3", "Playback, quality, Liquid Glass, privacy") }'''
assert a in s
s = s.replace(a, '''                        Button { showOffline = true } label: { profileAction("Offline Library", "arrow.down.circle.fill", "Watch imported videos without internet") }
''' + a, 1)
a = '''            .sheet(isPresented: $showSettings) { SettingsView().environmentObject(app) }'''
assert a in s
s = s.replace(a, a + '''
            .sheet(isPresented: $showOffline) { CivyOfflineLibraryView() }''', 1)
start = s.index('struct CivyDownloadsView: View {')
end = s.index('struct CivyNewAndHotView: View {', start)
s = s[:start] + '''struct CivyDownloadsView: View {
    var body: some View { CivyOfflineLibraryView() }
}

''' + s[end:]
a = '''                AsyncImage(url: imageURL, transaction: Transaction(animation: .easeInOut(duration: 0.42))) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        LinearGradient(colors: [Color(red: 0.38, green: 0.07, blue: 0.10), Color.synSurface], startPoint: .top, endPoint: .bottom)
                    }
                }'''
assert a in s
s = s.replace(a, '''                CivyCachedArtwork(url: imageURL)''', 1)
a = '''                        filterBar
                            .padding(.top, 16)'''
assert a in s
s = s.replace(a, a + '''
                        if let warning = app.homeError {
                            Label(warning, systemImage: "wifi.slash")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(.white.opacity(0.85))
                                .padding(.horizontal, 18).padding(.top, 8)
                        }''', 1)
s = s.replace('''            if app.home == nil { await app.loadHome() }
            await app.loadCurated()''','''            await app.loadHome()
            await app.loadCurated()''', 1)
rootview.write_text(s)

design = root / 'Civy/Design.swift'
s = design.read_text()
a = s.index('        AsyncImage(url: url, transaction: Transaction(animation: .easeInOut(duration: 0.22))) { phase in')
b = s.index('        .aspectRatio(aspect, contentMode: .fit)', a)
s = s[:a] + '        CivyCachedArtwork(url: url)\n' + s[b:]
a = s.index('            AsyncImage(url: url, transaction: Transaction(animation: .easeInOut(duration: 0.45))) { phase in')
b = s.index('            .frame(width: proxy.size.width, height: height)', a)
s = s[:a] + '            CivyCachedArtwork(url: url)\n' + s[b:]
design.write_text(s)

project = root / 'Civy.xcodeproj/project.pbxproj'
s = project.read_text()
insert = '''        B51F8A63D7B14C72AB9A3E20 /* PBXFileReference */ = { isa = PBXFileReference; lastKnownFileType = "sourcecode.swift"; path = "OfflineLibrary.swift"; sourceTree = "<group>"; };
        B51F8A63D7B14C72AB9A3E21 /* PBXBuildFile */ = { isa = PBXBuildFile; fileRef = "B51F8A63D7B14C72AB9A3E20"; };
        B51F8A63D7B14C72AB9A3E22 /* PBXFileReference */ = { isa = PBXFileReference; lastKnownFileType = "sourcecode.swift"; path = "OfflineArtwork.swift"; sourceTree = "<group>"; };
        B51F8A63D7B14C72AB9A3E23 /* PBXBuildFile */ = { isa = PBXBuildFile; fileRef = "B51F8A63D7B14C72AB9A3E22"; };
'''
a = '\t\t9F6CFF8906F1A9A5F87CD18B /* PBXFileReference */ = {'
assert a in s
s = s.replace(a, insert + a, 1)
a = 'B51F8A63D7B14C72AB9A3E12, 4DB5DC12'
assert a in s
s = s.replace(a, 'B51F8A63D7B14C72AB9A3E12, B51F8A63D7B14C72AB9A3E20, B51F8A63D7B14C72AB9A3E22, 4DB5DC12', 1)
a = 'B51F8A63D7B14C72AB9A3E13, 5B387801'
assert a in s
s = s.replace(a, 'B51F8A63D7B14C72AB9A3E13, B51F8A63D7B14C72AB9A3E21, B51F8A63D7B14C72AB9A3E23, 5B387801', 1)
assert s.count('MARKETING_VERSION = "3.7.0";') == 2
s = s.replace('MARKETING_VERSION = "3.7.0";', 'MARKETING_VERSION = "3.8.0";')
s = s.replace('CURRENT_PROJECT_VERSION = "6";', 'CURRENT_PROJECT_VERSION = "7";')
project.write_text(s)
print("Civy 3.8 Beta offline features applied.")
