import { Activity, CreditCard, Globe2, Orbit, RadioTower, Server, Settings2 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const items = [
  { label: "总览", href: "/", icon: Activity },
  { label: "全球网络", href: "/#network-map", icon: Globe2 },
  { label: "VPS 节点", href: "/#vps-nodes-heading", icon: Server },
  { label: "静态 IP", href: "/#static-ip-heading", icon: RadioTower },
  { label: "订阅资产", href: "/subscriptions", icon: CreditCard },
  { label: "主题管理", href: "/?view=theme-manage", icon: Settings2 },
] as const;

export function OrbitalSidebar() {
  const location = useLocation();

  return (
    <aside className="orbital-sidebar" aria-label="主导航">
      <Link className="orbital-brand" to="/" aria-label="Komari 首页">
        <span className="orbital-brand-mark"><Orbit size={25} strokeWidth={1.6} /></span>
        <span><strong>KOMARI</strong><small>NETWORK OBSERVATORY</small></span>
      </Link>
      <div className="orbital-nav-caption">MISSION CONTROL</div>
      <nav className="orbital-nav">
        {items.map(({ label, href, icon: Icon }) => {
          const active = href === "/"
            ? location.pathname === "/" && !location.hash && !location.search
            : href.startsWith("/#")
              ? location.pathname === "/" && location.hash === href.slice(1)
              : `${location.pathname}${location.search}` === href;
          return <Link key={href} to={href} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}>
            <Icon size={17} strokeWidth={1.7} /><span>{label}</span>
          </Link>;
        })}
      </nav>
      <div className="orbital-sidebar-bottom">
        <div className="orbital-signal"><span /> SYSTEM ONLINE</div>
        <small>MONITOR THE UNIVERSE</small>
      </div>
    </aside>
  );
}
