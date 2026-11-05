import SwiftUI
import UIKit

// Civy's personal library. All lists and activity belong to the selected
// on-device profile; no cloud/account/subscription features are implied.
struct CivyMyCivyView: View {
    @EnvironmentObject private var app: AppState
    @EnvironmentObject private var viewers: CivyViewerStore
    @State private var showList = false
    @State private var showHistory = false
    @State private var showSettings = false
    @State private var selectedTitle: Media?
    @AppStorage("civy.appearance.haptics") private var haptics = true

    private var viewer: CivyViewer {
        viewers.active ?? CivyViewer(id: "primary", name: "You",
                                     symbol: "person.fill", tintIndex: 0)
    }
    private var spotlight: Media? {
        app.history.first?.media ?? app.favorites.first ?? app.home?.trending.first
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 29) {
                        cinematicHeader
                        quickActions
                            .padding(.horizontal, 19)
                        if !app.history.isEmpty {
                            continueSection
                        }
                        listSection
                        accountSection
                            .padding(.horizontal, 19)
                        Text("Your lists and watching history are saved for this profile on this iPhone.")
                            .font(.system(size: 12))
                            .foregroundStyle(.white.opacity(0.36))
                            .frame(maxWidth: .infinity)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 29)
                    }
                    .padding(.bottom, 130)
                }
                .scrollIndicators(.hidden)
            }
            .ignoresSafeArea(edges: .top)
            .toolbar(.hidden, for: .navigationBar)
            .sheet(isPresented: $showList) {
                MyListView().environmentObject(app)
            }
            .sheet(isPresented: $showSettings) {
                SettingsView().environmentObject(app).environmentObject(viewers)
            }
            .sheet(isPresented: $showHistory) {
                CivyViewingHistoryView().environmentObject(app)
            }
            .sheet(item: $selectedTitle) {
                DetailView(media: $0).environmentObject(app)
            }
        }
    }

    private var cinematicHeader: some View {
        ZStack(alignment: .bottomLeading) {
            GeometryReader { proxy in
                CivyCachedArtwork(url: spotlight?.backdropURL)
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .clipped()
            }
            LinearGradient(stops: [
                .init(color: .black.opacity(0.49), location: 0),
                .init(color: .clear, location: 0.21),
                .init(color: .black.opacity(0.33), location: 0.43),
                .init(color: .black.opacity(0.88), location: 0.75),
                .init(color: .black, location: 1)
            ], startPoint: .top, endPoint: .bottom)
            .allowsHitTesting(false)

            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .center, spacing: 10) {
                    Text("S")
                        .font(.system(size: 33, weight: .black, design: .rounded))
                        .italic()
                        .foregroundStyle(Color.synAccent)
                    Text("My Civy")
                        .font(.system(size: 27, weight: .bold))
                        .tracking(-0.9)
                    Text("BETA")
                        .font(.system(size: 9, weight: .heavy))
                        .tracking(0.7)
                        .padding(.horizontal, 8).padding(.vertical, 5)
                        .glassEffect(.regular.tint(Color.synAccent.opacity(0.25)), in: Capsule())
                    Spacer()
                    Button { impact(); showSettings = true } label: {
                        Image(systemName: "gearshape")
                            .font(.system(size: 19, weight: .medium))
                            .frame(width: 46, height: 46)
                            .glassEffect(.regular.interactive(), in: Circle())
                    }
                    .accessibilityLabel("Settings")
                }
                .padding(.top, 59)

                Spacer(minLength: 75)

                HStack(alignment: .center, spacing: 16) {
                    CivyViewerAvatar(viewer: viewer, size: 78)
                        .shadow(color: .black.opacity(0.35), radius: 12, y: 7)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("YOUR SPACE")
                            .font(.system(size: 10, weight: .bold))
                            .tracking(1.8)
                            .foregroundStyle(.white.opacity(0.68))
                        Text(viewer.name)
                            .font(.system(size: 32, weight: .bold))
                            .tracking(-0.9)
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                        Text("Your movies. Your moments.")
                            .font(.system(size: 13))
                            .foregroundStyle(.white.opacity(0.76))
                    }
                    Spacer(minLength: 0)
                    Button { impact(); viewers.choosing = true } label: {
                        Image(systemName: "person.2.crop.square.stack")
                            .font(.system(size: 20, weight: .medium))
                            .frame(width: 46, height: 46)
                            .glassEffect(.regular.interactive(), in: Circle())
                    }
                    .accessibilityLabel("Switch or manage profiles")
                }
                .padding(.bottom, 22)

                HStack(spacing: 9) {
                    tinyStat("\(app.favorites.count)", "in My List", "bookmark")
                    tinyStat("\(app.history.count)", "watched", "play.rectangle")
                }
                .padding(.bottom, 11)
            }
            .padding(.horizontal, 22)
            .foregroundStyle(.white)
        }
        .frame(height: 350)
    }

    private func tinyStat(_ count: String, _ title: String, _ icon: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon).font(.system(size: 12))
            Text(count).fontWeight(.bold)
            Text(title).foregroundStyle(.white.opacity(0.74))
        }
        .font(.system(size: 12))
        .padding(.horizontal, 12).padding(.vertical, 8)
        .glassEffect(.regular.tint(.white.opacity(0.035)), in: Capsule())
    }

    private var quickActions: some View {
        GlassEffectContainer(spacing: 9) {
            HStack(spacing: 11) {
                shortcut("My List", icon: "bookmark.fill", count: app.favorites.count) {
                    showList = true
                }
                shortcut("History", icon: "clock.arrow.circlepath", count: app.history.count) {
                    showHistory = true
                }
                shortcut("Profiles", icon: "person.2.fill", count: nil) {
                    viewers.choosing = true
                }
            }
        }
    }

    private func shortcut(_ title: String, icon: String, count: Int?, action: @escaping () -> Void) -> some View {
        Button {
            impact()
            action()
        } label: {
            VStack(alignment: .leading, spacing: 21) {
                HStack(alignment: .top) {
                    Image(systemName: icon)
                        .font(.system(size: 21, weight: .medium))
                    Spacer(minLength: 0)
                    if let count {
                        Text("\(count)")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.white.opacity(0.58))
                    }
                }
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
            .foregroundStyle(.white)
            .padding(15)
            .frame(maxWidth: .infinity, minHeight: 104, alignment: .leading)
            .glassEffect(.regular.interactive(), in: RoundedRectangle(cornerRadius: 21))
            .overlay {
                RoundedRectangle(cornerRadius: 21)
                    .strokeBorder(.white.opacity(0.16), lineWidth: 0.8)
            }
        }
        .buttonStyle(.plain)
    }

    private var continueSection: some View {
        VStack(alignment: .leading, spacing: 15) {
            sectionHeader("Continue Watching", kicker: "PICK UP WHERE YOU LEFT OFF") {
                showHistory = true
            }
            ScrollView(.horizontal) {
                LazyHStack(spacing: 12) {
                    ForEach(app.history.prefix(14)) { record in
                        Button {
                            impact()
                            app.play(record.media, season: record.season, episode: record.episode)
                        } label: {
                            VStack(alignment: .leading, spacing: 9) {
                                ZStack(alignment: .bottomLeading) {
                                    MovieImage(url: record.media.backdropURL, aspect: 1.77, radius: 13)
                                        .frame(width: 250)
                                    LinearGradient(colors: [.clear, .black.opacity(0.54)],
                                                   startPoint: .center, endPoint: .bottom)
                                        .clipShape(RoundedRectangle(cornerRadius: 13))
                                    Image(systemName: "play.fill")
                                        .font(.system(size: 18, weight: .bold))
                                        .foregroundStyle(.white)
                                        .frame(width: 47, height: 47)
                                        .glassEffect(.regular.interactive(), in: Circle())
                                        .padding(12)
                                }
                                Text(record.media.displayTitle)
                                    .font(.system(size: 14, weight: .semibold))
                                    .lineLimit(1)
                                    .foregroundStyle(.white)
                                Text(record.media.kind == "tv" ?
                                     "S\(record.season ?? 1):E\(record.episode ?? 1) · Resume" :
                                     "Continue film")
                                    .font(.system(size: 12))
                                    .foregroundStyle(.white.opacity(0.56))
                            }
                            .frame(width: 250, alignment: .leading)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Resume \(record.media.displayTitle)")
                    }
                }
                .padding(.horizontal, 20)
            }
            .scrollIndicators(.hidden)
        }
    }

    private var listSection: some View {
        VStack(alignment: .leading, spacing: 15) {
            sectionHeader("My List", kicker: "SAVED FOR LATER") {
                showList = true
            }
            if app.favorites.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "bookmark")
                        .font(.system(size: 27, weight: .ultraLight))
                        .foregroundStyle(.white.opacity(0.75))
                    Text("Your list starts here")
                        .font(.system(size: 18, weight: .semibold))
                    Text("Find something you love, then tap My List to save it.")
                        .font(.system(size: 13))
                        .foregroundStyle(.white.opacity(0.57))
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 30).padding(.horizontal, 18)
                .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 24))
                .padding(.horizontal, 19)
            } else {
                ScrollView(.horizontal) {
                    LazyHStack(alignment: .top, spacing: 12) {
                        ForEach(app.favorites.prefix(20)) { media in
                            Button { impact(); selectedTitle = media } label: {
                                VStack(alignment: .leading, spacing: 8) {
                                    MovieImage(url: media.posterURL, radius: 11)
                                        .frame(width: 130)
                                    Text(media.displayTitle)
                                        .font(.system(size: 13, weight: .semibold))
                                        .lineLimit(1)
                                        .foregroundStyle(.white)
                                }
                                .frame(width: 130, alignment: .leading)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 20)
                }
                .scrollIndicators(.hidden)
            }
        }
    }

    private func sectionHeader(_ title: String, kicker: String, action: @escaping () -> Void) -> some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 5) {
                Text(kicker)
                    .font(.system(size: 10, weight: .bold))
                    .tracking(1.4)
                    .foregroundStyle(Color.synAccent)
                Text(title)
                    .font(.system(size: 24, weight: .bold))
                    .tracking(-0.7)
                    .foregroundStyle(.white)
            }
            Spacer(minLength: 10)
            Button { impact(); action() } label: {
                HStack(spacing: 5) {
                    Text("See all")
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .semibold))
                }
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white.opacity(0.79))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 21)
    }

    private var accountSection: some View {
        VStack(alignment: .leading, spacing: 13) {
            Text("YOUR EXPERIENCE")
                .font(.system(size: 11, weight: .bold))
                .tracking(1.5)
                .foregroundStyle(.white.opacity(0.52))
                .padding(.leading, 3)
            VStack(spacing: 0) {
                accountRow("Manage profiles", subtitle: "Choose who's watching",
                           icon: "person.crop.square.filled.and.at.rectangle") {
                    viewers.choosing = true
                }
                Rectangle().fill(.white.opacity(0.09)).frame(height: 1).padding(.leading, 66)
                accountRow("App Settings", subtitle: "Appearance, player, privacy",
                           icon: "slider.horizontal.3") {
                    showSettings = true
                }
            }
            .padding(.horizontal, 14)
            .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 24))
        }
    }

    private func accountRow(_ title: String, subtitle: String, icon: String,
                            action: @escaping () -> Void) -> some View {
        Button {
            impact()
            action()
        } label: {
            HStack(spacing: 15) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .medium))
                    .frame(width: 38)
                    .foregroundStyle(.white.opacity(0.85))
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(.system(size: 16, weight: .semibold))
                    Text(subtitle).font(.system(size: 12))
                        .foregroundStyle(.white.opacity(0.54))
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.5))
            }
            .foregroundStyle(.white)
            .padding(.vertical, 17)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func impact() {
        if haptics { UISelectionFeedbackGenerator().selectionChanged() }
    }
}

private struct CivyViewingHistoryView: View {
    @EnvironmentObject private var app: AppState
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                if app.history.isEmpty {
                    ContentUnavailableView("Nothing watched yet",
                                           systemImage: "play.rectangle",
                                           description: Text("Movies and episodes you start will appear here."))
                } else {
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            ForEach(app.history) { record in
                                Button {
                                    dismiss()
                                    app.play(record.media, season: record.season, episode: record.episode)
                                } label: {
                                    HStack(spacing: 14) {
                                        MovieImage(url: record.media.posterURL, radius: 10)
                                            .frame(width: 70)
                                        VStack(alignment: .leading, spacing: 5) {
                                            Text(record.media.displayTitle)
                                                .font(.system(size: 16, weight: .semibold))
                                                .lineLimit(2)
                                            Text(record.media.kind == "tv" ?
                                                 "Season \(record.season ?? 1) · Episode \(record.episode ?? 1)" :
                                                 "Movie")
                                                .font(.system(size: 13))
                                                .foregroundStyle(.white.opacity(0.60))
                                        }
                                        Spacer()
                                        Image(systemName: "play.circle.fill")
                                            .font(.system(size: 28))
                                            .foregroundStyle(Color.synAccent)
                                    }
                                    .foregroundStyle(.white)
                                    .padding(11)
                                    .glassEffect(.regular.interactive(),
                                                 in: RoundedRectangle(cornerRadius: 17))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 18).padding(.vertical, 12)
                    }
                    .scrollIndicators(.hidden)
                }
            }
            .navigationTitle("Watch History")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) {
                Button("Done") { dismiss() }
            } }
        }
        .preferredColorScheme(.dark)
    }
}
