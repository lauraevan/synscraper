import Foundation

struct MediaItem: Codable, Identifiable, Hashable {
    let id: Int
    let title: String?
    let name: String?
    let overview: String?
    let poster_path: String?
    let backdrop_path: String?
    let vote_average: Double?
    let release_date: String?
    let first_air_date: String?
    let media_type: String?
    let popularity: Double?

    var displayTitle: String { title ?? name ?? "Untitled" }

    var kind: String {
        if media_type == "tv" || media_type == "movie" { return media_type! }
        if name != nil || first_air_date != nil { return "tv" }
        return "movie"
    }

    var year: String {
        let raw = kind == "tv" ? first_air_date : release_date
        return raw.map { String($0.prefix(4)) } ?? ""
    }

    var posterURL: URL? {
        guard let poster_path else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/w500\(poster_path)")
    }

    var backdropURL: URL? {
        guard let backdrop_path else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/original\(backdrop_path)")
    }

    static func == (lhs: MediaItem, rhs: MediaItem) -> Bool {
        lhs.id == rhs.id && lhs.kind == rhs.kind
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
        hasher.combine(kind)
    }
}

struct HomeFeed: Codable {
    let trending: [MediaItem]?
    let popular_movies: [MediaItem]?
    let top_rated_movies: [MediaItem]?
    let now_playing: [MediaItem]?
    let popular_tv: [MediaItem]?
    let top_rated_tv: [MediaItem]?
    let upcoming: [MediaItem]?
}

struct MediaEnvelope: Codable {
    let results: [MediaItem]?
}

struct Genre: Codable, Identifiable, Hashable {
    let id: Int
    let name: String
}

struct MediaDetails: Codable {
    let id: Int
    let title: String?
    let name: String?
    let overview: String?
    let poster_path: String?
    let backdrop_path: String?
    let vote_average: Double?
    let release_date: String?
    let first_air_date: String?
    let runtime: Int?
    let episode_run_time: [Int]?
    let number_of_seasons: Int?
    let genres: [Genre]?
    let seasons: [SeasonSummary]?
    let credits: Credits?
    let similar: MediaEnvelope?
    let recommendations: MediaEnvelope?

    var displayTitle: String { title ?? name ?? "Untitled" }
    var year: String {
        let raw = release_date ?? first_air_date
        return raw.map { String($0.prefix(4)) } ?? ""
    }

    var posterURL: URL? {
        guard let poster_path else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/w780\(poster_path)")
    }

    var backdropURL: URL? {
        guard let backdrop_path else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/original\(backdrop_path)")
    }

    var runtimeText: String? {
        guard let runtime, runtime > 0 else { return nil }
        let h = runtime / 60
        let m = runtime % 60
        if h > 0 { return "\(h)h \(m)m" }
        return "\(m)m"
    }
}

struct Credits: Codable {
    let cast: [CastMember]?
}

struct CastMember: Codable, Identifiable, Hashable {
    let id: Int
    let name: String
    let character: String?
    let profile_path: String?

    var profileURL: URL? {
        guard let profile_path else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/w342\(profile_path)")
    }
}

struct SeasonSummary: Codable, Identifiable, Hashable {
    let id: Int
    let name: String
    let season_number: Int
    let episode_count: Int?
    let poster_path: String?

    var posterURL: URL? {
        guard let poster_path else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/w500\(poster_path)")
    }
}

struct SeasonDetails: Codable {
    let id: Int?
    let name: String?
    let season_number: Int?
    let episodes: [EpisodeSummary]?
}

struct EpisodeSummary: Codable, Identifiable, Hashable {
    let id: Int
    let name: String
    let overview: String?
    let episode_number: Int
    let season_number: Int
    let runtime: Int?
    let still_path: String?
    let vote_average: Double?

    var stillURL: URL? {
        guard let still_path else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/w500\(still_path)")
    }
}

struct StreamEnvelope: Codable {
    let type: String?
    let id: String?
    let season: Int?
    let episode: Int?
    let count: Int?
    let servers: [StreamServer]?
}

struct StreamServer: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let provider: String?
    let primary: Bool?
    let type: String?
    let quality: String?
    let play_url: String
}

struct PlayerRequest: Identifiable, Hashable {
    let media: MediaItem
    let season: Int?
    let episode: Int?

    var id: String {
        "\(media.kind)-\(media.id)-\(season ?? 0)-\(episode ?? 0)"
    }

    var title: String { media.displayTitle }
}
