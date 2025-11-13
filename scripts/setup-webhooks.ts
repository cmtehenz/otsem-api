import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { InterWebhookService } from '../src/inter/services/inter-webhook.service';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        logger: ['error', 'warn', 'log'],
    });

    const webhookService = app.get(InterWebhookService);

    const webhookUrl =
        process.env.WEBHOOK_BASE_URL || 'https://api.otsembank.com';

    console.log('🔧 Configurando webhook Pix da Inter...\n');
    console.log(`📍 URL Base: ${webhookUrl}\n`);

    try {
        // ✅ Verificar webhook Pix existente
        console.log('🔍 Verificando webhook Pix existente...\n');

        let pixCallback: any = { webhookUrl: null };

        try {
            pixCallback = await webhookService.getCallbacks('pix');
            console.log('Pix atual:', pixCallback?.webhookUrl || 'Nenhum');
        } catch (error: any) {
            console.log('⚠️ Não foi possível consultar (continuando...)');
        }

        console.log();

        // ✅ Configurar webhook Pix
        console.log('📱 Configurando webhook de Pix...');
        try {
            const result = await webhookService.createCallback('pix', {
                webhookUrl: `${webhookUrl}/inter/webhooks/receive/pix`,
            });

            console.log('✅ Webhook Pix configurado com sucesso!\n');
            console.log('Resposta da Inter:');
            console.log(JSON.stringify(result, null, 2));
            console.log();
        } catch (error: any) {
            console.error('❌ Erro ao configurar Pix:', error.message);
            console.error('Detalhes:', error.response?.data || error);
            console.log();

            // Não sair com erro, só informar
            console.log('⚠️ Verifique as credenciais e certificados.\n');
        }

        // ✅ Verificação final
        console.log('✅ Verificação final:');

        try {
            const pixFinal = await webhookService.getCallbacks('pix');
            console.log('Pix:', pixFinal?.webhookUrl || 'Não cadastrado');

            if (pixFinal?.webhookUrl) {
                console.log('\n🎉 Webhook cadastrado! Agora você receberá notificações de Pix.');
            }
        } catch (error: any) {
            console.log('Pix: Não foi possível verificar');
            console.log('\n💡 Dica: Verifique manualmente no portal da Inter ou teste recebendo um Pix.');
        }
    } catch (error: any) {
        console.error('❌ Erro fatal:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }

    await app.close();
    process.exit(0);
}

bootstrap().catch((error) => {
    console.error('❌ Erro ao inicializar:', error);
    process.exit(1);
});