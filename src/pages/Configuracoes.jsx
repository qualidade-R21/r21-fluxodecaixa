import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EmpreendimentosConfig from '@/components/config/EmpreendimentosConfig';
import SociosConfig from '@/components/config/SociosConfig';
import CiclosConfig from '@/components/config/CiclosConfig';
import ParticipacaoConfig from '@/components/config/ParticipacaoConfig';
import ProjetosConfig from '@/components/config/ProjetosConfig';

export default function Configuracoes() {
  return (
    <div className="space-y-8">
      <h1 className="text-[28px] font-heading font-bold">Configurações</h1>
      <Tabs defaultValue="ciclos">
        <TabsList className="font-heading text-[15px]">
          <TabsTrigger value="ciclos">Ciclos</TabsTrigger>
          <TabsTrigger value="empreendimentos">Empreendimentos</TabsTrigger>
          <TabsTrigger value="socios">Sócios</TabsTrigger>
          <TabsTrigger value="participacoes">Participações</TabsTrigger>
          <TabsTrigger value="projetos">Projetos Internos</TabsTrigger>
        </TabsList>
        <TabsContent value="ciclos"><CiclosConfig /></TabsContent>
        <TabsContent value="empreendimentos"><EmpreendimentosConfig /></TabsContent>
        <TabsContent value="socios"><SociosConfig /></TabsContent>
        <TabsContent value="participacoes"><ParticipacaoConfig /></TabsContent>
        <TabsContent value="projetos"><ProjetosConfig /></TabsContent>
      </Tabs>
    </div>
  );
}