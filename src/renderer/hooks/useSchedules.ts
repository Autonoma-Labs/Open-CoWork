import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function useSchedules() {
  const queryClient = useQueryClient()

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => window.api.getSchedules()
  })

  const createSchedule = useMutation({
    mutationFn: (data: {
      title: string
      prompt: string
      frequencyText: string
      cron: string
      timezone?: string | null
      model: string
      enabled?: boolean
    }) => window.api.createSchedule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
    }
  })

  const updateSchedule = useMutation({
    mutationFn: (params: { id: string; data: Record<string, unknown> }) =>
      window.api.updateSchedule(params.id, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      queryClient.invalidateQueries({ queryKey: ['scheduleRuns'] })
    }
  })

  const deleteSchedule = useMutation({
    mutationFn: (id: string) => window.api.deleteSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      queryClient.invalidateQueries({ queryKey: ['scheduleRuns'] })
    }
  })

  const runScheduleNow = useMutation({
    mutationFn: (id: string) => window.api.runScheduleNow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleRuns'] })
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
    }
  })

  return {
    schedules,
    isLoading,
    createSchedule: createSchedule.mutateAsync,
    updateSchedule: updateSchedule.mutateAsync,
    deleteSchedule: deleteSchedule.mutateAsync,
    runScheduleNow: runScheduleNow.mutateAsync,
    isCreating: createSchedule.isPending,
    isUpdating: updateSchedule.isPending,
    isRunning: runScheduleNow.isPending
  }
}

export function useScheduleRuns(scheduleId?: string) {
  const queryClient = useQueryClient()

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['scheduleRuns', scheduleId || 'all'],
    queryFn: () => window.api.getScheduleRuns(scheduleId),
    enabled: true
  })

  const updateRun = useMutation({
    mutationFn: (params: { id: string; data: Record<string, unknown> }) =>
      window.api.updateScheduleRun(params.id, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleRuns'] })
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
    }
  })

  return {
    runs,
    isLoading,
    updateRun: updateRun.mutateAsync,
    isUpdating: updateRun.isPending
  }
}
