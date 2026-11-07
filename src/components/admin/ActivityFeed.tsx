import {
  ShoppingBag,
  UserPlus,
  CreditCard,
  XCircle,
  Settings,
  TrendingUp,
  Clock,
} from "lucide-react";

const activities = [
  {
    icon: CreditCard,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50",
    title: "Pagamento recebido",
    description: "João Silva pagou R$ 89,90",
    time: "Há 5 min",
  },
  {
    icon: ShoppingBag,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50",
    title: "Novo pedido criado",
    description: "Pedido #12345 foi criado",
    time: "Há 12 min",
  },
  {
    icon: UserPlus,
    iconColor: "text-pink-600",
    iconBg: "bg-pink-50",
    title: "Novo cliente",
    description: "Maria Santos se cadastrou",
    time: "Há 1h",
  },
  {
    icon: XCircle,
    iconColor: "text-red-600",
    iconBg: "bg-red-50",
    title: "Pedido cancelado",
    description: "Pedido #12341 foi cancelado",
    time: "Há 2h",
  },
  {
    icon: TrendingUp,
    iconColor: "text-amber-600",
    iconBg: "bg-amber-50",
    title: "Meta atingida",
    description: "Você atingiu 80% da meta",
    time: "Há 3h",
  },
  {
    icon: Settings,
    iconColor: "text-gray-600",
    iconBg: "bg-gray-50",
    title: "Configuração alterada",
    description: "Taxa de entrega atualizada",
    time: "Há 5h",
  },
];

export function ActivityFeed() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200/60 p-6 hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300 h-full">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Atividades Recentes</h3>
        <p className="text-sm text-gray-600 mt-1">Últimas ações na plataforma</p>
      </div>

      {/* Activity List */}
      <div className="space-y-4">
        {activities.map((activity, index) => {
          const Icon = activity.icon;
          return (
            <div
              key={index}
              className="group flex gap-4 p-3 rounded-xl hover:bg-gray-50/80 transition-all duration-200 cursor-pointer"
            >
              {/* Icon */}
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-lg ${activity.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}
              >
                <Icon className={`w-5 h-5 ${activity.iconColor}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {activity.title}
                </p>
                <p className="text-sm text-gray-600 truncate mt-0.5">
                  {activity.description}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Clock className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-500">{activity.time}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* View All Link */}
      <button className="w-full mt-4 py-2.5 text-sm font-medium text-[#C8285F] hover:text-[#3d1e70] hover:bg-pink-50 rounded-xl transition-all duration-200">
        Ver todas as atividades
      </button>
    </div>
  );
}
