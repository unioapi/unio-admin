import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ActivityIcon,
  BoxIcon,
  CableIcon,
  FolderIcon,
  GaugeIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  RouteIcon,
  ServerCogIcon,
  ServerIcon,
  SlidersHorizontalIcon,
  TriangleAlertIcon,
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
  // 自定义高亮判定（用于共享路由的 Tab，如「计费异常」= /ledger?tab=exceptions）。
  match?: (loc: { pathname: string; search: string }) => boolean;
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
      { title: "项目", to: "/projects", icon: FolderIcon },
    ],
  },
  {
    label: "请求中心",
    items: [
      { title: "请求记录", to: "/requests", icon: ActivityIcon },
      { title: "用量分析", to: "/usage", icon: GaugeIcon },
      {
        title: "账本流水",
        to: "/ledger",
        icon: WalletIcon,
        match: (loc) =>
          loc.pathname.startsWith("/ledger") &&
          !new URLSearchParams(loc.search).get("tab")?.includes("exceptions"),
      },
      {
        title: "计费异常",
        to: "/ledger?tab=exceptions",
        icon: TriangleAlertIcon,
        match: (loc) =>
          loc.pathname.startsWith("/ledger") &&
          new URLSearchParams(loc.search).get("tab") === "exceptions",
      },
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
  if (item.match) return item.match(loc);
  return defaultActive(item.to, loc.pathname);
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

  // 当前页标题：优先精确 match 项，回退到路径前缀首个匹配。
  const current =
    NAV_ITEMS.find((item) => item.match && item.match(loc)) ??
    NAV_ITEMS.find((item) => defaultActive(item.to, loc.pathname));

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
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isItemActive(item, loc)}
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
          <h1 className="font-heading text-sm font-medium">
            {current?.title ?? "Unio 控制台"}
          </h1>
          <div className="ml-auto">
            <ModeToggle />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
