import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ActivityIcon,
  BoxIcon,
  CableIcon,
  FolderIcon,
  GaugeIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  ServerCogIcon,
  ServerIcon,
  SlidersHorizontalIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
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

const NAV_GROUPS = [
  {
    label: "管理",
    items: [
      { title: "概览", to: "/", icon: LayoutDashboardIcon },
      { title: "服务商", to: "/providers", icon: ServerIcon },
      { title: "渠道", to: "/channels", icon: CableIcon },
      { title: "模型", to: "/models", icon: BoxIcon },
      { title: "能力", to: "/capability", icon: SlidersHorizontalIcon },
    ],
  },
  {
    label: "客户",
    items: [
      { title: "用户", to: "/users", icon: UsersIcon },
      { title: "项目", to: "/projects", icon: FolderIcon },
    ],
  },
  {
    label: "查询",
    items: [
      { title: "请求", to: "/requests", icon: ActivityIcon },
      { title: "用量", to: "/usage", icon: GaugeIcon },
      { title: "账本", to: "/ledger", icon: WalletIcon },
    ],
  },
  {
    label: "运营",
    items: [{ title: "系统", to: "/system", icon: ServerCogIcon }],
  },
];

const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

function isItemActive(to: string, pathname: string): boolean {
  return to === "/" ? pathname === "/" : pathname.startsWith(to);
}

export function AppLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const current = NAV_ITEMS.find((item) => isItemActive(item.to, pathname));

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
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={isItemActive(item.to, pathname)}
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
