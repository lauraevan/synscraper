import SwiftUI

// Live is an honest discovery destination until a licensed live-channel API is connected.
struct CivyLiveView: View {
    @EnvironmentObject private var app: AppState
    @State private var selected: Media?
    private var highlights: [Media] {
        (app.home?.popularTv ?? []) + (app.home?.topRatedTv ?? [])
    }
    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        HStack {
                            Image(systemName: "dot.radiowaves.left.and.right")
                                .font(.system(size: 24))
                                .foregroundStyle(Color.synAccent)
                            Text("Live").font(.system(size: 34, weight: .bold))
                            Spacer()
                            Text("BETA")
                                .font(.system(size: 11, weight: .bold))
                                .padding(.horizontal, 10).padding(.vertical, 6)
                                .background(Color.synAccent, in: Capsule())
                        }
                        .padding(.top, 7)
                        VStack(alignment: .leading, spacing: 14) {
                            Image(systemName: "tv")
                                .font(.system(size: 33, weight: .light))
                                .foregroundStyle(Color.synAccent)
                            Text("Live TV is coming to Civy")
                                .font(.system(size: 26, weight: .bold))
                            Text("There isn't a live-TV source connected to your Synscraper server yet. You can explore featured series below while this Beta feature is developed.")
                                .font(.system(size: 15))
                                .foregroundStyle(.white.opacity(0.74))
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(23)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(LinearGradient(colors: [Color(red: 0.21, green: 0.08, blue: 0.10), Color.synSurface], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 25))
                        if !highlights.isEmpty {
                            Text("Featured series")
                                .font(.system(size: 24, weight: .bold))
                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 13) {
                                ForEach(Array(highlights.prefix(14))) { media in
                                    Button { selected = media } label: {
                                        VStack(alignment: .leading, spacing: 8) {
                                            MovieImage(url: media.posterURL, radius: 12)
                                            Text(media.displayTitle)
                                                .font(.system(size: 14, weight: .medium))
                                                .foregroundStyle(.white)
                                                .lineLimit(2)
                                        }
                                    }.buttonStyle(.plain)
                                }
                            }
                        }
                        Spacer(minLength: 120)
                    }
                    .padding(.horizontal, 18)
                }
                .scrollIndicators(.hidden)
            }
            .toolbar(.hidden, for: .navigationBar)
            .sheet(item: $selected) { DetailView(media: $0).environmentObject(app) }
            .task { if app.home == nil { await app.loadHome() } }
        }
    }
}