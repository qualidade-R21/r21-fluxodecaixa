import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useEmpreendimentos() {
  return useQuery({
    queryKey: ['empreendimentos'],
    queryFn: () => base44.entities.Empreendimento.list('ordem_exibicao', 100),
    initialData: [],
  });
}

export function useCicloAtivo() {
  return useQuery({
    queryKey: ['ciclo-ativo'],
    queryFn: async () => {
      const ciclos = await base44.entities.Ciclo.filter({ status: 'ativo' });
      return ciclos[0] || null;
    },
    initialData: null,
  });
}

export function useSemanas(cicloId) {
  return useQuery({
    queryKey: ['semanas', cicloId],
    queryFn: () => base44.entities.Semana.filter({ ciclo_id: cicloId }, 'numero', 6),
    enabled: !!cicloId,
    initialData: [],
  });
}

export function useLancamentos(cicloId, semanaIds) {
  return useQuery({
    queryKey: ['lancamentos', cicloId, semanaIds],
    queryFn: async () => {
      if (!semanaIds || semanaIds.length === 0) return [];
      const all = await base44.entities.LancamentoSemanal.list('-created_date', 500);
      return all.filter(l => semanaIds.includes(l.semana_id));
    },
    enabled: !!cicloId && semanaIds?.length > 0,
    initialData: [],
  });
}

export function useSaldos(cicloId) {
  return useQuery({
    queryKey: ['saldos', cicloId],
    queryFn: () => base44.entities.SaldoEmpreendimento.filter({ ciclo_id: cicloId }, '-created_date', 100),
    enabled: !!cicloId,
    initialData: [],
  });
}

export function useSocios() {
  return useQuery({
    queryKey: ['socios'],
    queryFn: () => base44.entities.Socio.list('nome', 50),
    initialData: [],
  });
}

export function useParticipacoes() {
  return useQuery({
    queryKey: ['participacoes'],
    queryFn: () => base44.entities.Participacao.list('-created_date', 200),
    initialData: [],
  });
}

export function useProjetosInternos(empreendimentoId) {
  return useQuery({
    queryKey: ['projetos-internos', empreendimentoId],
    queryFn: async () => {
      if (!empreendimentoId) return [];
      return base44.entities.ProjetoInterno.filter({ empreendimento_pai_id: empreendimentoId });
    },
    enabled: !!empreendimentoId,
    initialData: [],
  });
}

export function useAporteOverridesRicardo(cicloId) {
  return useQuery({
    queryKey: ['aporte-overrides-ricardo', cicloId],
    queryFn: async () => {
      if (!cicloId) return [];
      return base44.entities.AporteOverrideRicardo.filter({ ciclo_id: cicloId }, '-created_date', 200);
    },
    enabled: !!cicloId,
    initialData: [],
  });
}

export function useSalvarAporteOverridesRicardo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cicloId, overrides }) => {
      const existing = await base44.entities.AporteOverrideRicardo.filter({ ciclo_id: cicloId }, '-created_date', 200);
      const map = {};
      existing.forEach(r => { map[`${r.row_label}__${r.semana_id}`] = r; });
      const toCreate = [];
      const toUpdate = [];
      overrides.forEach(o => {
        const key = `${o.row_label}__${o.semana_id}`;
        if (map[key]) {
          toUpdate.push({ id: map[key].id, valor: o.valor });
        } else {
          toCreate.push({ row_label: o.row_label, semana_id: o.semana_id, ciclo_id: cicloId, valor: o.valor });
        }
      });
      if (toCreate.length > 0) await base44.entities.AporteOverrideRicardo.bulkCreate(toCreate);
      if (toUpdate.length > 0) await base44.entities.AporteOverrideRicardo.bulkUpdate(toUpdate);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aporte-overrides-ricardo'] });
    },
  });
}

export function useDespesasProjetos(semanaIds) {
  return useQuery({
    queryKey: ['despesas-projetos', semanaIds],
    queryFn: async () => {
      if (!semanaIds || semanaIds.length === 0) return [];
      const all = await base44.entities.DespesaProjetoSemanal.list('-created_date', 500);
      return all.filter(d => semanaIds.includes(d.semana_id));
    },
    enabled: semanaIds?.length > 0,
    initialData: [],
  });
}