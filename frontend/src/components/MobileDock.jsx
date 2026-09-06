import { Bookmark, Film, Home, Search, Tv2 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const ITEMS = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/browse/movie", label: "Movies", icon: Film },
  { to: "/search", label: "Search", icon: Search },
  { to: "/my-list", label: "My List", icon: Bookmark },
  { to: "/browse/tv", label: "TV", icon: Tv2 },
];

export function MobileDock() {
  const location = useLocation();

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.to;
    return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
  };

  return (
    <nav className="synflix-mobile-dock md:hidden" aria-label="Phone navigation">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isActive(item);
        return (
          <Link key={item.to} to={item.to} data-active={active ? "true" : "false"} aria-current={active ? "page" : undefined}>
            <Icon aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
