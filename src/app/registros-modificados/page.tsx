import RegistrosModificadosClient from './RegistrosModificadosClient';

export const metadata = {
    title: 'Registros Modificados | Control Calidad',
    description: 'Lista de registros que han sido editados recientemente.',
};

export default function RegistrosModificadosPage() {
    return <RegistrosModificadosClient />;
}
