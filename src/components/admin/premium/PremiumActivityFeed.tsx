"use client";

import {
  ShoppingBag,
  User,
  AlertCircle,
  Star,
  MessageSquare,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Activity {
  id: string;
  type: "order" | "customer" | "alert" | "review" | "message";
  title: string;
  description: string;
  time: Date;
  priority?: "high" | "medium" | "low";
}

interface PremiumActivityFeedProps {
  title?: string;
  activities?: Activity[];
}

const activityConfig = {
  order: {
    icon: ShoppingBag,
    color: "text-[#C8285F]",
    bg: "bg-[#FDE6EE]",
  },
  customer: {
    icon: User,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  alert: {
    icon: AlertCircle,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  review: {
    icon: Star,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  message: {
    icon: MessageSquare,
    color: "text-pink-600",
    bg: "bg-pink-50",
  },
};

const defaultActivities: Activity[] = [
  {
    id: "1",
    type: "order",
    title: "Novo pedido recebido",
    description: "Pedido #12345 - R$ 89,90",
    time: new Date(Date.now() - 1000 * 60 * 5),
    priority: "high",
  },
  {
    id: "2",
    type: "alert",
    title: "Pedido atrasado",
    description: "Pedido #12340 está há 45min em preparo",
    time: new Date(Date.now() - 1000 * 60 * 15),
    priority: "high",
  },
  {
    id: "3",
    type: "review",
    title: "Nova avaliação",
    description: "Cliente deixou 5 estrelas",
    time: new Date(Date.now() - 1000 * 60 * 30),
    priority: "medium",
  },
  {
    id: "4",
    type: "customer",
    title: "Novo cliente",
    description: "Maria Silva se cadastrou",
    time: new Date(Date.now() - 1000 * 60 * 45),
    priority: "low",
  },
  {
    id: "5",
    type: "alert",
    title: "Produto sem estoque",
    description: "Pote 1 Litro de Morango está esgotado",
    time: new Date(Date.now() - 1000 * 60 * 60),
    priority: "medium",
  },
  {
    id: "6",
    type: "message",
    title: "Nova mensagem",
    description: "Cliente enviou uma mensagem",
    time: new Date(Date.now() - 1000 * 60 * 90),
    priority: "medium",
  },
];

export function PremiumActivityFeed({
  title = "Atividade Recente",
  activities = defaultActivities,
}: PremiumActivityFeedProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] hover:shadow-lg transition-all duration-200 h-full">
      <div className="p-6 border-b border-[#E5E7EB]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#111827]">{title}</h3>
            <p className="text-sm text-[#6B7280] mt-1">
              Últimas {activities.length} atualizações
            </p>
          </div>
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
        </div>
      </div>

      <div className="p-6">
        <div className="space-y-4">
          {activities.map((activity, index) => {
            const config = activityConfig[activity.type];
            const Icon = config.icon;
            const timeAgo = formatDistanceToNow(activity.time, {
              addSuffix: true,
              locale: ptBR,
            });

            return (
              <div key={activity.id} className="relative">
                {index !== activities.length - 1 && (
                  <div className="absolute left-4 top-10 bottom-0 w-px bg-[#E5E7EB]" />
                )}
                <div className="flex gap-3 group">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200",
                      config.bg,
                      "group-hover:scale-110"
                    )}
                  >
                    <Icon className={cn("w-4 h-4", config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-[#111827] line-clamp-1">
                        {activity.title}
                      </p>
                      {activity.priority === "high" && (
                        <span className="flex-shrink-0 w-2 h-2 bg-red-500 rounded-full" />
                      )}
                    </div>
                    <p className="text-xs text-[#6B7280] mt-0.5 line-clamp-1">
                      {activity.description}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3 text-[#6B7280]" />
                      <span className="text-xs text-[#6B7280]">{timeAgo}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-6 border-t border-[#E5E7EB]">
        <button className="w-full text-sm font-medium text-[#C8285F] hover:text-[#E33E70] transition-colors">
          Ver todas as atividades
        </button>
      </div>
    </div>
  );
}
