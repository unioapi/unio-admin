import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ActivityIcon,
  BoxIcon,
  CableIcon,
  GaugeIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  RouteIcon,
  ServerCogIcon,
  ServerIcon,
  SlidersHorizontalIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/theme/ModeToggle";
import { useAuth } from "@/lib/auth/AuthContext";

interface NavItem {
  title: string;
  to: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// §1.3 目标侧栏 IA：概览 / 网关中心 / 客户中心 / 请求中心 / 系统设置。
const NAV_GROUPS: NavGroup[] = [
  {
    label: "概览",
    items: [{ title: "概览", to: "/overview", icon: LayoutDashboardIcon }],
  },
  {
    label: "网关中心",
    items: [
      { title: "服务商", to: "/providers", icon: ServerIcon },
      { title: "渠道", to: "/channels", icon: CableIcon },
      { title: "模型", to: "/models", icon: BoxIcon },
      { title: "线路", to: "/routes", icon: RouteIcon },
      { title: "能力", to: "/capability", icon: SlidersHorizontalIcon },
    ],
  },
  {
    label: "客户中心",
    items: [
      { title: "用户", to: "/users", icon: UsersIcon },
    ],
  },
  {
    label: "请求中心",
    items: [
      { title: "请求记录", to: "/requests", icon: ActivityIcon },
      { title: "用量分析", to: "/usage", icon: GaugeIcon },
      { title: "账本", to: "/ledger", icon: WalletIcon },
    ],
  },
  {
    label: "系统设置",
    items: [{ title: "系统设置", to: "/system", icon: ServerCogIcon }],
  },
];

const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

function defaultActive(to: string, pathname: string): boolean {
  const path = to.split("?")[0];
  return path === "/" ? pathname === "/" : pathname.startsWith(path);
}

function isItemActive(
  item: NavItem,
  loc: { pathname: string; search: string },
): boolean {
  return defaultActive(item.to, loc.pathname);
}

function isEntityDetailPath(pathname: string): boolean {
  return /\/(providers|channels|models|routes|users)\/\d+/.test(pathname);
}

export function AppLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const loc = { pathname: location.pathname, search: location.search };

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const current = NAV_ITEMS.find((item) => defaultActive(item.to, loc.pathname));
  const headerTitle = isEntityDetailPath(loc.pathname) ? null : (current?.title ?? "Unio 控制台");

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 px-1 py-1.5">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <span className="text-sm font-semibold">U</span>
            </div>
            <span className="font-heading text-sm font-semibold">
              UNIO 控制台
            </span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          {NAV_GROUPS.map((group) => (
            <SidebarGroup key={group.label} className="py-1">
              <SidebarGroupLabel className="h-7">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isItemActive(item, loc)}
                        size="sm"
                        tooltip={item.title}
                      >
                        <Link to={item.to}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={handleLogout}
          >
            <LogOutIcon data-icon="inline-start" />
            登出
          </Button>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          {headerTitle ? (
            <h1 className="font-heading text-sm font-medium">{headerTitle}</h1>
          ) : null}
          <div className="ml-auto">
            <ModeToggle />
          </div>
        </header>
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
