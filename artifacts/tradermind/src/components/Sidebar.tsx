import { Link, useLocation } from "wouter";
import { useAppStore } from "../store/useAppStore";
import {
  LayoutDashboard,
  GitMerge,
  ActivitySquare,
  Wallet,
  BookOpen,
  BarChart3,
  HardDrive,
  Settings,
  Menu,
  X,
  ChevronLeft,
  TrendingUp,
  Zap,
  UserCircle2,
  Brain,
  RotateCcw,
  FileInput,
  ShieldCheck,
  Search,
  Shield,
  Calculator,
  Camera,
  Lightbulb,
  HeartPulse,
} from "lucide-react";

import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { t } from "../lib/i18n";


interface NavItemProps {
  href: string;
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  onClick?: () => void;
}


function NavItem({
  href,
  icon: Icon,
  label,
  isActive,
  onClick,
}: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium min-h-[44px]",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      )}
      onClick={onClick}
    >
      <Icon className="h-5 w-5 shrink-0" />

      <span>{label}</span>

      {isActive && (
        <ChevronLeft className="h-4 w-4 ms-auto opacity-60" />
      )}
    </Link>
  );
}



function BottomNavItem({
  href,
  icon: Icon,
  label,
  isActive,
}: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center justify-center flex-1 h-full gap-1 min-w-0 transition-colors px-1",
        isActive ? "text-primary" : "text-muted-foreground"
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0",
          isActive && "scale-110"
        )}
      />

      <span className="text-[10px] font-medium leading-none truncate max-w-full">
        {label}
      </span>
    </Link>
  );
}




export function Sidebar() {

  const [location] = useLocation();

  const {
    sidebarOpen,
    setSidebarOpen,
    appName,
  } = useAppStore();



  const isActive = (href: string) =>
    href === "/"
      ? location === "/"
      : location.startsWith(href);




  const navGroups = [

    {
      title: t.nav.main,
      items: [
        {
          href: "/",
          icon: LayoutDashboard,
          label: t.nav.dashboard,
        },
      ],
    },


    {
      title: t.nav.trading,
      items: [
        {
          href: "/strategies",
          icon: GitMerge,
          label: t.nav.strategies,
        },
        {
          href: "/analysis",
          icon: ActivitySquare,
          label: t.nav.analysis,
        },
      ],
    },



    {
      title: t.nav.journal,
      items: [
        {
          href: "/journal/trades",
          icon: Wallet,
          label: t.nav.trades,
        },
        {
          href: "/journal/daily",
          icon: BookOpen,
          label: t.nav.dailyJournal,
        },
        {
          href: "/journal/insights",
          icon: Lightbulb,
          label: "نکات معاملاتی",
        },
      ],
    },



    {
      title: t.nav.insights,
      items: [
        {
          href: "/knowledge",
          icon: Brain,
          label: "پایگاه دانش",
        },
        {
          href: "/screenshots",
          icon: Camera,
          label: "هوش اسکرین‌شات",
        },
        {
          href: "/replay",
          icon: RotateCcw,
          label: "ری‌پلی و شبیه‌سازی",
        },
        {
          href: "/profile",
          icon: UserCircle2,
          label: "پروفایل من",
        },
        {
          href: "/reports",
          icon: BarChart3,
          label: t.nav.reports,
        },
        {
          href: "/analytics/edge",
          icon: Zap,
          label: "کشف مزیت",
        },
        {
          href: "/symbols",
          icon: TrendingUp,
          label: "نمادها",
        },
      ],
    },



    {
      title: "تحلیل عملکرد",
      items: [
        {
          href: "/performance",
          icon: BarChart3,
          label: "داشبورد عملکرد",
        },
        {
          href: "/analytics/advanced",
          icon: Zap,
          label: "تحلیل پیشرفته",
        },
        {
          href: "/analytics/psychology",
          icon: HeartPulse,
          label: "روانشناسی معامله‌گر",
        },
      ],
    },



    {
      title: "مدیریت ریسک",
      items: [
        {
          href: "/risk/management",
          icon: Shield,
          label: "داشبورد ریسک",
        },
        {
          href: "/risk/planner",
          icon: Calculator,
          label: "ماشین‌حساب ریسک",
        },
        {
          href: "/risk/profile",
          icon: ShieldCheck,
          label: "پروفایل ریسک",
        },
      ],
    },



    {
      title: "داده‌ها",
      items: [
        {
          href: "/search",
          icon: Search,
          label: "جستجوی جهانی",
        },
        {
          href: "/import",
          icon: FileInput,
          label: "وارد کردن داده",
        },
        {
          href: "/data-quality",
          icon: ShieldCheck,
          label: "کیفیت داده",
        },
      ],
    },



    {
      title: t.nav.system,
      items: [
        {
          href: "/backup",
          icon: HardDrive,
          label: t.nav.backup,
        },
        {
          href: "/settings",
          icon: Settings,
          label: t.nav.settings,
        },
      ],
    },

  ];



  const bottomItems = [
    {
      href: "/",
      icon: LayoutDashboard,
      label: t.nav.dashboard,
    },
    {
      href: "/analysis",
      icon: ActivitySquare,
      label: "تحلیل",
    },
    {
      href: "/journal/daily",
      icon: BookOpen,
      label: "ژورنال",
    },
    {
      href: "/journal/trades",
      icon: Wallet,
      label: "معاملات",
    },
    {
      href: "/reports",
      icon: BarChart3,
      label: "گزارش‌ها",
    },
  ];
  return (
    <>
      {/* ── پوشش موبایل وقتی Sidebar باز است */}
      {sidebarOpen && (
        <div
          className="
            fixed
            left-0
            right-0
            bottom-0
            top-14
            bg-background/80
            backdrop-blur-sm
            z-40
            md:hidden
          "
          onClick={() => setSidebarOpen(false)}
        />
      )}



      {/* ── Sidebar دسکتاپ + Drawer موبایل */}
      <aside
        className={cn(
          "fixed right-0 z-50 w-64 bg-sidebar border-l flex flex-col",
          "transition-transform duration-300 ease-in-out",
          "md:translate-x-0",
          sidebarOpen
            ? "translate-x-0"
            : "translate-x-full"
        )}
        style={{
          top: "56px",
          height: "calc(100dvh - 56px)",
        }}
      >


        {/* هدر Sidebar */}
        <div
          className="
            flex
            items-center
            justify-between
            px-4
            border-b
            shrink-0
          "
          style={{
            minHeight: "56px",
          }}
        >

          <div className="
            flex
            items-center
            gap-2
            font-semibold
            text-lg
            tracking-tight
          ">
            <div className="
              w-6
              h-6
              rounded
              bg-primary
              flex
              items-center
              justify-center
            ">
              <ActivitySquare
                className="
                  w-4
                  h-4
                  text-primary-foreground
                "
              />
            </div>

            {appName}
          </div>



          <Button
            variant="ghost"
            size="icon"
            className="
              md:hidden
              h-8
              w-8
            "
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>

        </div>





        {/* لیست ناوبری */}
        <div className="
          flex-1
          overflow-y-auto
          py-4
        ">

          {navGroups.map((group, i) => (

            <div
              key={i}
              className="
                mb-6
                px-3
              "
            >

              <h4
                className="
                  mb-1.5
                  px-3
                  text-xs
                  font-semibold
                  text-muted-foreground
                  uppercase
                  tracking-wider
                "
              >
                {group.title}
              </h4>



              <div className="space-y-0.5">

                {group.items.map((item, j) => (

                  <NavItem
                    key={j}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    isActive={isActive(item.href)}
                    onClick={() =>
                      setSidebarOpen(false)
                    }
                  />

                ))}

              </div>


            </div>

          ))}

        </div>





        {/* نسخه برنامه */}
        <div
          className="
            p-4
            border-t
            shrink-0
          "
        >
          <p className="
            text-xs
            text-muted-foreground
            text-center
          ">
            TraderMind • v1.0.0
          </p>
        </div>


      </aside>





      {/* ── نوار بالای موبایل */}
      <div
        className="
          md:hidden
          fixed
          top-0
          left-0
          right-0
          z-30
          bg-background/95
          backdrop-blur-sm
          border-b
          flex
          items-center
          px-4
          gap-3
        "
        style={{
          height: "56px",
          paddingTop:
            "env(safe-area-inset-top)",
        }}
      >

        <span className="
          font-semibold
          flex-1
          text-base
        ">
          {appName}
        </span>



        <Button
          variant="ghost"
          size="icon"
          className="
            h-10
            w-10
          "
          onClick={() =>
            setSidebarOpen(true)
          }
        >
          <Menu className="h-5 w-5" />
        </Button>


      </div>







      {/* ── Bottom Navigation موبایل */}
      <nav
        className="
          md:hidden
          fixed
          bottom-0
          left-0
          right-0
          z-30
          bg-background/95
          backdrop-blur-sm
          border-t
          flex
          items-stretch
        "
        style={{
          height:
            "calc(56px + env(safe-area-inset-bottom, 0px))",

          paddingBottom:
            "env(safe-area-inset-bottom, 0px)",
        }}
      >

        {bottomItems.map((item, i) => (

          <BottomNavItem
            key={i}
            href={item.href}
            icon={item.icon}
            label={item.label}
            isActive={
              isActive(item.href)
            }
          />

        ))}


      </nav>


    </>
  );
}
