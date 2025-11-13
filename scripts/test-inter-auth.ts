import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { InterAuthService } from '../src/inter/services/inter-auth.service';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        logger: ['log', 'error', 'warn'],
    });

    const authService = app.get(InterAuthService);

    try {
        console.log('🔐 Testando autenticação com Banco Inter...\n');

        // Obter token
        const token = await authService.getToken();
        console.log('✅ Token obtido com sucesso!');
        console.log('Token:', token.substring(0, 50) + '...');
        console.log();

        // Testar endpoint simples (saldo)
        const axios = authService.getAxiosInstance();
        console.log('💰 Consultando saldo...');

        const response = await axios.get('/banking/v2/saldo');
        console.log('✅ Saldo consultado com sucesso!');
        console.log('Resposta:', JSON.stringify(response.data, null, 2));
    } catch (error: any) {
        console.error('❌ Erro na autenticação:', error.message);
        console.error('Response:', error.response?.data);

        if (error.response?.status === 401) {
            console.error('\n💡 Possíveis causas:');
            console.error('   1. CLIENT_ID ou CLIENT_SECRET incorretos');
            console.error('   2. Certificados (.crt e .key) inválidos ou de sandbox');
            console.error('   3. Certificados não correspondem ao CLIENT_ID');
            console.error('   4. Caminho dos certificados está errado no .env');
        }
    }

    await app.close();
}

bootstrap();