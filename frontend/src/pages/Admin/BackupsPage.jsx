import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Server, Database, HardDrive, RefreshCw, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getBackupList, getBackupStatus, generateBackup, deleteBackup } from '../../services/backupService';
import { BackupTable } from '../../components/admin/BackupTable';
import { Topbar } from '../../components/layout/Topbar';

export const BackupsPage = () => {
  const queryClient = useQueryClient();

  // Queries
  const { data: status, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['backupStatus'],
    queryFn: getBackupStatus,
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });

  const { data: backups, isLoading: isLoadingList, isError: isListError } = useQuery({
    queryKey: ['backupList'],
    queryFn: getBackupList,
  });

  // Mutations
  const generateMutation = useMutation({
    mutationFn: generateBackup,
    onSuccess: (res) => {
      toast.success(res.message || 'Respaldo generado correctamente');
      queryClient.invalidateQueries({ queryKey: ['backupList'] });
      queryClient.invalidateQueries({ queryKey: ['backupStatus'] });
    },
    onError: () => {
      toast.error('Fallo al generar el respaldo de la base de datos');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBackup,
    onSuccess: () => {
      toast.success('Respaldo eliminado');
      queryClient.invalidateQueries({ queryKey: ['backupList'] });
      queryClient.invalidateQueries({ queryKey: ['backupStatus'] });
    },
    onError: () => {
      toast.error('Fallo al eliminar el respaldo');
    }
  });

  const handleGenerateBackup = () => {
    generateMutation.mutate();
  };

  const handleDeleteBackup = (filename) => {
    deleteMutation.mutate(filename);
  };

  return (
    <div className="app-layout">
      <Topbar 
        title="Módulo de Respaldos" 
        subtitle="Administra los respaldos automatizados de la base de datos"
        rightContent={
          <button 
            className="btn btn--primary" 
            onClick={handleGenerateBackup}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <RefreshCw className="spinner" size={18} />
            ) : (
              <Database size={18} />
            )}
            <span>{generateMutation.isPending ? 'Generando...' : 'Generar Respaldo'}</span>
          </button>
        }
      />

      <main className="main-content">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
            <div style={{ padding: '1rem', background: 'var(--primary-10)', color: 'var(--primary-600)', borderRadius: 'var(--radius-md)' }}>
              <HardDrive size={24} />
            </div>
            <div>
              <div className="text-muted text-sm mb-1">Uso de Disco</div>
              <div className="font-bold text-xl">{isLoadingStatus ? 'Cargando...' : status?.diskUsageFormatted || '0 Bytes'}</div>
              <div className="text-xs text-muted mt-1">Ubicación: {status?.backupDirectory || '/var/backups'}</div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
            <div style={{ padding: '1rem', background: 'var(--success-10)', color: 'var(--success-600)', borderRadius: 'var(--radius-md)' }}>
              <Database size={24} />
            </div>
            <div>
              <div className="text-muted text-sm mb-1">Total de Respaldos</div>
              <div className="font-bold text-xl">{isLoadingStatus ? 'Cargando...' : status?.totalBackups || 0}</div>
              <div className="text-xs text-muted mt-1">Retención: 7 días</div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
            <div style={{ padding: '1rem', background: 'var(--info-10)', color: 'var(--info-600)', borderRadius: 'var(--radius-md)' }}>
              <Server size={24} />
            </div>
            <div>
              <div className="text-muted text-sm mb-1">Estado Automático</div>
              <div className="font-bold text-xl">Activo</div>
              <div className="text-xs mt-1" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--info-600)' }}>
                <AlertCircle size={14} /> Próximo: 02:00 AM
              </div>
            </div>
          </div>
        </div>

        {isLoadingList ? (
          <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
            <RefreshCw className="spinner text-primary" size={32} />
          </div>
        ) : isListError ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <AlertCircle size={48} style={{ color: 'var(--clr-danger)', margin: '0 auto 1rem' }} />
            <h3 style={{ color: 'var(--clr-danger)', marginBottom: '0.5rem' }}>Error al cargar respaldos</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              No se pudo conectar con el servicio de respaldos. Verifica que el backend esté accesible y la ruta del API esté configurada correctamente.
            </p>
          </div>
        ) : (
          <BackupTable 
            backups={backups} 
            onDelete={handleDeleteBackup}
            isDeleting={deleteMutation.isPending}
          />
        )}
      </main>
    </div>
  );
};
