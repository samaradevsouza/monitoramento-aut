const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');

const app = express();

app.use(cors());
app.use(bodyParser.json());

app.post('/consultar', async (req, res) => {
    const { chave } = req.body;

    if (!chave) {
        return res.status(400).json({ error: 'Senha de acesso é obrigatória.' });
    }

    try {
        const browser = await puppeteer.launch({ headless: false }); 
        const page = await browser.newPage();

        await page.goto(
            'https://meu.registo.justica.gov.pt/Pedidos/Consultar-estado-do-processo-de-nacionalidade',
            { waitUntil: 'domcontentloaded' }
        );
        await page.setViewport({
            width: 900,
            height: 550,
          });
          
        await page.waitForSelector('#Input_TextVar', { timeout: 10000 });

        await page.type('#Input_TextVar', chave, { delay: 100 });

        console.log('Resolva o CAPTCHA na página aberta...');

        await page.waitForSelector('#b13-b2-More > div > div:nth-child(2) > span');
        const nomeReq = await page.locator("#b13-b2-More > div > div:nth-child(2) > span").waitHandle();
        const contentNome = await nomeReq?.evaluate(el => el.textContent.trim());
        console.log('Nome:', contentNome);

        await page.waitForSelector('#b13-b2-Id2 > span');
        const numProcesso = await page.locator("#b13-b2-Id2 > span").waitHandle();
        const contentNumProcesso = await numProcesso?.evaluate(el => el.textContent.trim());
        console.log('Número do Processo:', contentNumProcesso || 'Erro em encontrar informações');

        const statusIcons = await page.$$('.wizard-item-icon');
        let phase = 0;

        for (const [index, icon] of statusIcons.entries()) {
            const hasAfterContent = await page.evaluate(el => {
                const style = window.getComputedStyle(el, '::after');
                return style && style.content !== 'none' && style.visibility !== 'hidden';
            }, icon);

            if (hasAfterContent) {
                phase = index + 1; 
            }
        }

        let status;
        switch (phase) {
            case 1:
                status = 'submetido';
                break;
            case 2:
                status = 'analise';
                break;
            case 3:
                status = 'decisao';
                break;
            case 4:
                status = 'concluido';
                break;
            default:
                status = 'Nenhuma fase identificada';
        }
        console.log('-- Esperando os elementos necessários carregarem...');
        await page.waitForSelector("#b11-\\$b1 > a > img", { visible: true, timeout: 5000 });
        await page.waitForSelector("#b13-b3-b2-Icon", { visible: true, timeout: 5000 });
        
        console.log('-- Capturando a screenshot...');
        await page.screenshot({
            path: 'monitoramento.png',
            width: 900,
            height: 500
        });

        console.log('Screenshot salva como "monitoramento.png".');

        await browser.close();

        res.json({
            nome: contentNome,
            numeroProcesso: contentNumProcesso,
            status: status,
        });
    } catch (error) {
        console.error('Erro:', error.message);
        res.status(500).json({ error: 'Erro ao consultar os dados.' });
    }
});

app.listen(3000, () => {
    console.log('Servidor rodando em http://localhost:3000');
});
