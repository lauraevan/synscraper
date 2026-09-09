import Foundation

actor SynFlixAPI {
    static let shared = SynFlixAPI()

    private let apiBase = URL(string: "https://synscraper-tffk.vercel.app/api")!
    private let siteBase = URL(string: "https://synscraper-tffk.vercel.app")!
    private let decoder = JSONDecoder()

    enum APIError: LocalizedError {
        case invalidURL
        case badStatus(Int)
        case noStreams

        var errorDescription: String? {
            switch self {
            case .invalidURL: return "SynFlix couldn't create that request."
            case .badStatus(let code): return "SynFlix returned HTTP \(code)."
            case .noStreams: return "No playable sources are available right now."
            }
        }
    }

    private func request<T: Decodable>(
        _ path: String,
        query: [URLQueryItem] = [],
        timeout: TimeInterval = 30
    ) async throws -> T {
        var components = URLComponents(url: apiBase.appendingPathComponent(path), resolvingAgainstBaseURL: false)
        if !query.isEmpty { components?.queryItems = query }
        guard let url = components?.url else { throw APIError.invalidURL }

        var request = URLRequest(url: url)
        request.timeoutInterval = timeout
        request.cachePolicy = .returnCacheDataElseLoad
        request.setValue("SynFlix-iOS-Native/1.5", forHTTPHeaderField: "User-Agent")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.badStatus(-1) }
        guard (200..<300).contains(http.statusCode) else { throw APIError.badStatus(http.statusCode) }
        return try decoder.decode(T.self, from: data)
    }

    func home() async throws -> HomeFeed {
        try await request("home", timeout: 24)
    }

    func search(_ query: String) async throws -> [MediaItem] {
        let response: MediaEnvelope = try await request(
            "search",
            query: [URLQueryItem(name: "q", value: query), URLQueryItem(name: "page", value: "1")],
            timeout: 24
        )
        return response.results ?? []
    }

    func details(kind: String, id: Int) async throws -> MediaDetails {
        try await request("details/\(kind)/\(id)", timeout: 24)
    }

    func season(showID: Int, season: Int) async throws -> SeasonDetails {
        try await request("tv/\(showID)/season/\(season)", timeout: 24)
    }

    func discover(kind: String, genre: Int? = nil, page: Int = 1) async throws -> [MediaItem] {
        var query = [
            URLQueryItem(name: "sort_by", value: "popularity.desc"),
            URLQueryItem(name: "page", value: String(page))
        ]
        if let genre { query.append(URLQueryItem(name: "with_genres", value: String(genre))) }
        let response: MediaEnvelope = try await request("discover/\(kind)", query: query, timeout: 24)
        return response.results ?? []
    }

    func streams(for requestInfo: PlayerRequest) async throws -> [StreamServer] {
        var query = [
            URLQueryItem(name: "type", value: requestInfo.media.kind),
            URLQueryItem(name: "id", value: String(requestInfo.media.id)),
            URLQueryItem(name: "title", value: requestInfo.media.displayTitle)
        ]
        if !requestInfo.media.year.isEmpty {
            query.append(URLQueryItem(name: "year", value: requestInfo.media.year))
        }
        if let season = requestInfo.season {
            query.append(URLQueryItem(name: "season", value: String(season)))
        }
        if let episode = requestInfo.episode {
            query.append(URLQueryItem(name: "episode", value: String(episode)))
        }

        let response: StreamEnvelope = try await request("streams", query: query, timeout: 90)
        let servers = response.servers ?? []
        guard !servers.isEmpty else { throw APIError.noStreams }
        return servers
    }

    func playableURL(for server: StreamServer) -> URL? {
        if server.play_url.hasPrefix("http://") || server.play_url.hasPrefix("https://") {
            return URL(string: server.play_url)
        }
        return URL(string: server.play_url, relativeTo: siteBase)?.absoluteURL
    }
}
