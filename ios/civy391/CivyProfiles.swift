import SwiftUI
import UIKit

// Private, on-device profiles. No account or cloud service is implied.
struct CivyViewer: Codable, Identifiable, Equatable {
    var id: String
    var name: String
    var symbol: String
    var tintIndex: Int
}

@MainActor
final class CivyViewerStore: ObservableObject {
    @Published private(set) var viewers: [CivyViewer]
    @Published private(set) var selectedID: String?
    @Published var choosing = true
    static let icons = ["person.fill", "star.fill", "bolt.fill", "heart.fill", "moon.stars.fill", "gamecontroller.fill", "sparkles", "pawprint.fill", "sun.max.fill", "film.fill"]
    static let palette: [Color] = [
        Color(red: 0.71, green: 0.12, blue: 0.18), Color(red: 0.14, green: 0.41, blue: 0.73),
        Color(red: 0.65, green: 0.36, blue: 0.83), Color(red: 0.18, green: 0.57, blue: 0.45),
        Color(red: 0.92, green: 0.51, blue: 0.13), Color(red: 0.34, green: 0.31, blue: 0.72)
    ]
    var active: CivyViewer? { viewers.first { $0.id == selectedID } }
    init() {
        if let data = UserDefaults.standard.data(forKey: "civy.viewerProfiles"),
           let old = try? JSONDecoder().decode([CivyViewer].self, from: data), !old.isEmpty {
            viewers = old
        } else {
            let name = UserDefaults.standard.string(forKey: "civy.profile.name") ?? "You"
            viewers = [CivyViewer(id: "primary", name: name == "My Profile" ? "You" : name,
                                  symbol: "person.fill", tintIndex: 0)]
        }
        selectedID = UserDefaults.standard.string(forKey: "civy.selectedViewer")
    }
    func choose(_ viewer: CivyViewer, app: AppState) {
        guard viewers.contains(where: { $0.id == viewer.id }) else { return }
        selectedID = viewer.id
        UserDefaults.standard.set(viewer.id, forKey: "civy.selectedViewer")
        UserDefaults.standard.set(viewer.name, forKey: "civy.profile.name")
        UserDefaults.standard.set(viewer.symbol, forKey: "civy.profile.icon")
        app.activateProfile(viewer.id)
        withAnimation(.easeInOut(duration: 0.24)) { choosing = false }
    }
    func save(_ viewer: CivyViewer) {
        guard !viewer.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        if let i = viewers.firstIndex(where: { $0.id == viewer.id }) { viewers[i] = viewer }
        else if viewers.count < 5 { viewers.append(viewer) }
        persist()
        if selectedID == viewer.id {
            UserDefaults.standard.set(viewer.name, forKey: "civy.profile.name")
            UserDefaults.standard.set(viewer.symbol, forKey: "civy.profile.icon")
        }
    }
    func delete(_ viewer: CivyViewer) {
        guard viewers.count > 1 else { return }
        viewers.removeAll { $0.id == viewer.id }
        if selectedID == viewer.id { selectedID = nil }
        persist()
    }
    private func persist() {
        if let data = try? JSONEncoder().encode(viewers) { UserDefaults.standard.set(data, forKey: "civy.viewerProfiles") }
    }
}

struct CivyViewerAvatar: View {
    let viewer: CivyViewer
    var size: CGFloat = 104
    var selected = false
    var body: some View {
        let tint = CivyViewerStore.palette[abs(viewer.tintIndex) % CivyViewerStore.palette.count]
        RoundedRectangle(cornerRadius: size * 0.115, style: .continuous)
            .fill(LinearGradient(colors: [tint.opacity(0.85), tint, tint.opacity(0.55)], startPoint: .topLeading, endPoint: .bottomTrailing))
            .overlay {
                Circle().fill(.white.opacity(0.16)).frame(width: size * 0.7)
                    .blur(radius: size * 0.25).offset(x: size * 0.30, y: -size * 0.35)
                    .clipShape(RoundedRectangle(cornerRadius: size * 0.115))
            }
            .overlay {
                Image(systemName: viewer.symbol)
                    .font(.system(size: size * 0.48, weight: .medium))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.2), radius: 6, y: 4)
            }
            .overlay {
                RoundedRectangle(cornerRadius: size * 0.115)
                    .strokeBorder(.white.opacity(selected ? 0.95 : 0.20), lineWidth: selected ? 3 : 1)
            }
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

struct CivyWhoIsWatching: View {
    @EnvironmentObject private var store: CivyViewerStore
    @EnvironmentObject private var app: AppState
    @State private var managing = false
    @State private var adding = false
    @State private var editing: CivyViewer?
    @State private var artIndex = 0
    @AppStorage("civy.appearance.reduceMotion") private var reduceMotion = false
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 13), count: 3)

    private var gallery: [Media] {
        guard let home = app.home else { return [] }
        var seen = Set<String>()
        return Array((home.trending + home.popularMovies + home.popularTv)
            .filter { $0.posterPath != nil && seen.insert($0.key).inserted }.prefix(15))
    }

    var body: some View {
        GeometryReader { geo in
            ZStack {
                Color.black.ignoresSafeArea()
                if !gallery.isEmpty {
                    let media = gallery[artIndex % gallery.count]
                    AsyncImage(url: TMDBImage.url(media.posterPath, size: "w780")) { phase in
                        if let image = phase.image { image.resizable().scaledToFill() }
                        else { Color(red: 0.23, green: 0.05, blue: 0.07) }
                    }
                    .frame(width: geo.size.width, height: geo.size.height)
                    .clipped().id(media.key).transition(.opacity)
                    .accessibilityHidden(true)
                } else {
                    LinearGradient(colors: [Color(red: 0.26, green: 0.05, blue: 0.07), .black],
                                   startPoint: .top, endPoint: .bottom)
                }
                LinearGradient(stops: [
                    .init(color: .black.opacity(0.28), location: 0),
                    .init(color: .black.opacity(0.07), location: 0.25),
                    .init(color: .black.opacity(0.30), location: 0.45),
                    .init(color: .black.opacity(0.87), location: 0.67),
                    .init(color: .black.opacity(0.99), location: 1)
                ], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
                    .allowsHitTesting(false)
                VStack(spacing: 0) {
                    HStack(spacing: 7) {
                        Text("C").italic()
                            .font(.system(size: 42, weight: .black))
                            .foregroundStyle(Color.synAccent)
                            .accessibilityLabel("Civy")
                        Text("BETA")
                            .font(.system(size: 11, weight: .bold))
                            .padding(.horizontal, 9).padding(.vertical, 5)
                            .glassEffect(.regular.tint(Color.synAccent.opacity(0.32)), in: Capsule())
                        Spacer()
                        Button(managing ? "Done" : "Edit") {
                            withAnimation(.smooth(duration: 0.28)) { managing.toggle() }
                        }
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 18).padding(.vertical, 11)
                        .glassEffect(.regular.interactive(), in: Capsule())
                    }
                    .padding(.horizontal, 24).padding(.top, 13)
                    Spacer(minLength: 100)
                    VStack(spacing: 22) {
                        VStack(spacing: 7) {
                            Text("Who's Watching?")
                                .font(.system(size: geo.size.width < 355 ? 30 : 35, weight: .bold))
                                .tracking(-0.8)
                            Text(managing ? "Choose a profile to edit" : "Your cinema starts here")
                                .font(.system(size: 14))
                                .foregroundStyle(.white.opacity(0.74))
                        }
                        LazyVGrid(columns: columns, spacing: 21) {
                            ForEach(store.viewers) { viewer in
                                Button {
                                    if managing { editing = viewer }
                                    else { store.choose(viewer, app: app) }
                                } label: {
                                    VStack(spacing: 10) {
                                        ZStack(alignment: .topTrailing) {
                                            CivyViewerAvatar(viewer: viewer,
                                                size: min(102, (geo.size.width - 88) / 3),
                                                selected: store.selectedID == viewer.id && !managing)
                                            if managing {
                                                Image(systemName: "pencil")
                                                    .font(.system(size: 11, weight: .bold))
                                                    .frame(width: 27, height: 27)
                                                    .glassEffect(.regular, in: Circle())
                                                    .offset(x: 5, y: -5)
                                            }
                                        }
                                        Text(viewer.name).font(.system(size: 14, weight: .medium))
                                            .lineLimit(1)
                                    }
                                }
                                .buttonStyle(CivyProfilePressStyle())
                                .accessibilityLabel(managing ? "Edit \(viewer.name)" : "Watch as \(viewer.name)")
                            }
                            if store.viewers.count < 5 {
                                Button { adding = true } label: {
                                    VStack(spacing: 10) {
                                        RoundedRectangle(cornerRadius: 13)
                                            .fill(.white.opacity(0.035))
                                            .overlay {
                                                Image(systemName: "plus")
                                                    .font(.system(size: 27, weight: .light))
                                            }
                                            .glassEffect(.regular.interactive(),
                                                         in: RoundedRectangle(cornerRadius: 13))
                                            .frame(width: min(102, (geo.size.width - 88) / 3),
                                                   height: min(102, (geo.size.width - 88) / 3))
                                        Text("Add Profile").font(.system(size: 14, weight: .medium))
                                    }
                                }
                                .buttonStyle(CivyProfilePressStyle())
                            }
                        }
                        .padding(.horizontal, 25)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 26)
                    .background {
                        RoundedRectangle(cornerRadius: 27, style: .continuous)
                            .fill(.black.opacity(0.18))
                            .glassEffect(.regular.tint(.black.opacity(0.20)),
                                         in: RoundedRectangle(cornerRadius: 27))
                    }
                    .padding(.horizontal, 12)
                    Text("CIVY BETA")
                        .font(.system(size: 11, weight: .medium)).tracking(1.2)
                        .foregroundStyle(.white.opacity(0.50))
                        .padding(.top, 20).padding(.bottom, 24)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .preferredColorScheme(.dark)
        .task { if app.home == nil { await app.loadHome() } }
        .task(id: gallery.map(\.key).joined(separator: ",")) {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(6))
                if Task.isCancelled { break }
                if gallery.count > 1 {
                    if reduceMotion { artIndex = (artIndex + 1) % gallery.count }
                    else {
                        withAnimation(.easeInOut(duration: 1.1)) {
                            artIndex = (artIndex + 1) % gallery.count
                        }
                    }
                }
            }
        }
        .sheet(isPresented: $adding) {
            CivyProfileEditor(original: nil, onSave: { store.save($0) }, onDelete: nil)
                .presentationDetents([.medium, .large])
        }
        .sheet(item: $editing) { viewer in
            CivyProfileEditor(original: viewer, onSave: { store.save($0) },
                              onDelete: { store.delete(viewer) })
                .presentationDetents([.medium, .large])
        }
    }
}

private struct CivyProfilePressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.scaleEffect(configuration.isPressed ? 0.95 : 1)
            .opacity(configuration.isPressed ? 0.82 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.76), value: configuration.isPressed)
    }
}

private struct CivyProfileEditor: View {
    @Environment(\.dismiss) private var dismiss
    let original: CivyViewer?
    let onSave: (CivyViewer) -> Void
    let onDelete: (() -> Void)?
    @State private var name: String
    @State private var symbol: String
    @State private var tint: Int
    init(original: CivyViewer?, onSave: @escaping (CivyViewer) -> Void, onDelete: (() -> Void)?) {
        self.original = original; self.onSave = onSave; self.onDelete = onDelete
        _name = State(initialValue: original?.name ?? "")
        _symbol = State(initialValue: original?.symbol ?? "star.fill")
        _tint = State(initialValue: original?.tintIndex ?? 1)
    }
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack { Spacer(); CivyViewerAvatar(viewer: CivyViewer(id: "preview", name: name, symbol: symbol, tintIndex: tint), size: 95); Spacer() }
                    TextField("Profile name", text: $name)
                        .textInputAutocapitalization(.words)
                        .autocorrectionDisabled()
                }
                Section("Avatar") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 5), spacing: 15) {
                        ForEach(CivyViewerStore.icons, id: \.self) { icon in
                            Button { symbol = icon } label: {
                                Image(systemName: icon)
                                    .font(.system(size: 20)).foregroundStyle(.white)
                                    .frame(width: 45, height: 45)
                                    .background(symbol == icon ? Color.synAccent : Color.white.opacity(0.10), in: RoundedRectangle(cornerRadius: 10))
                            }.buttonStyle(.plain)
                        }
                    }.padding(.vertical, 5)
                }
                Section("Color") {
                    HStack(spacing: 12) {
                        ForEach(CivyViewerStore.palette.indices, id: \.self) { i in
                            Button { tint = i } label: {
                                Circle().fill(CivyViewerStore.palette[i])
                                    .frame(width: 35, height: 35)
                                    .overlay { if tint == i { Image(systemName: "checkmark").font(.system(size: 15, weight: .bold)).foregroundStyle(.white) } }
                            }.buttonStyle(.plain)
                        }
                    }
                }
                if onDelete != nil {
                    Section {
                        Button("Delete profile", role: .destructive) { onDelete?(); dismiss() }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.synBackground)
            .navigationTitle(original == nil ? "New Profile" : "Edit Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
                        onSave(CivyViewer(id: original?.id ?? UUID().uuidString, name: trimmed, symbol: symbol, tintIndex: tint))
                        dismiss()
                    }
                    .fontWeight(.semibold)
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .tint(Color.synAccent)
    }
}
