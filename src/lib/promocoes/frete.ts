export type FreteCampaignWindow = {
  data_inicio: string;
  data_fim: string;
  hora_inicio?: string | null;
  hora_fim?: string | null;
};

export function getSaoPauloDateTime(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

export function isFreteCampaignActive(
  campaign: FreteCampaignWindow,
  now = getSaoPauloDateTime()
) {
  if (now.date < campaign.data_inicio || now.date > campaign.data_fim) {
    return false;
  }

  const startTime = campaign.hora_inicio?.slice(0, 5) ?? "00:00";
  const endTime = campaign.hora_fim?.slice(0, 5) ?? "23:59";
  if (now.date === campaign.data_inicio && now.time < startTime) return false;
  if (now.date === campaign.data_fim && now.time > endTime) return false;
  return true;
}

export function getFreteDeadlineLabel(
  dataFim: string,
  horaFim: string,
  hoje: string
) {
  const time = horaFim.slice(0, 5);
  if (dataFim === hoje) return `Hoje, até ${time}`;
  const [year, month, day] = dataFim.split("-");
  return `Até ${day}/${month}, ${time}`;
}

/** Refresh only at a campaign boundary or local midnight (deadline labels change then). */
export function nextFreteRefresh(campaigns: FreteCampaignWindow[], now = Date.now()) {
  const today = getSaoPauloDateTime(new Date(now)).date;
  const candidates = [Date.parse(today + "T00:00:00-03:00") + 86_400_000];
  for (const campaign of campaigns) {
    candidates.push(Date.parse(campaign.data_inicio + "T" + (campaign.hora_inicio?.slice(0, 5) ?? "00:00") + ":00-03:00"));
    candidates.push(Date.parse(campaign.data_fim + "T" + (campaign.hora_fim?.slice(0, 5) ?? "23:59") + ":00-03:00") + 60_000);
  }
  return Math.min(...candidates.filter(value => Number.isFinite(value) && value > now));
}
