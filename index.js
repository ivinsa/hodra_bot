require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

let userData = {};
let userSteps = {};

const mainMenu = {
    reply_markup: {
        keyboard: [
            [{ text: 'Отправить отчёт' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    }
};

bot.start((ctx) => {
    ctx.reply('Добро пожаловать! Выберите действие:', mainMenu);
});

bot.hears('Отправить отчёт', (ctx) => {
    const userId = ctx.from.id;
    userData[userId] = {};
    userSteps[userId] = 'date';
    ctx.reply('Выберите дату продажи:', Markup.inlineKeyboard([
        [{ text: 'Сегодня', callback_data: 'today' }],
        [{ text: 'Ввести дату', callback_data: 'enter_date' }]
    ]));
});

bot.action('today', (ctx) => {
    const userId = ctx.from.id;
    const today = new Date().toISOString().split('T')[0];
    userData[userId].saleDate = today;
    userSteps[userId] = 'name';
    ctx.reply('Введите ФИО клиента:');
});

bot.action('enter_date', (ctx) => {
    const userId = ctx.from.id;
    userSteps[userId] = 'enter_date';
    ctx.reply('Введите дату в формате ГГГГ-ММ-ДД:');
});

bot.on('text', (ctx) => {
    const userId = ctx.from.id;
    const messageText = ctx.message.text;

    switch (userSteps[userId]) {
        case 'enter_date':
            userData[userId].saleDate = messageText;
            userSteps[userId] = 'name';
            ctx.reply('Введите ФИО клиента:');
            break;
        case 'name':
            userData[userId].name = messageText;
            userSteps[userId] = 'phone';
            ctx.reply('Введите номер телефона клиента:');
            break;
        case 'phone':
            userData[userId].phone = messageText;
            userSteps[userId] = 'address';
            ctx.reply('Введите адрес клиента:');
            break;
        case 'address':
            userData[userId].address = messageText;
            userSteps[userId] = 'product';
            ctx.reply('Выберите товар:', Markup.inlineKeyboard([
                [{ text: 'Диван', callback_data: 'Диван' }],
                [{ text: 'Кресло', callback_data: 'Кресло' }],
                [{ text: 'Кухонный гарнитур', callback_data: 'Кухонный гарнитур' }],
                [{ text: 'Прихожая', callback_data: 'Прихожая' }],
                [{ text: 'Шкаф', callback_data: 'Шкаф' }]
            ]));
            break;
        case 'amount':
            userData[userId].amount = messageText;
            sendConfirmation(ctx, userId);
            userSteps[userId] = 'confirmation';
            break;
        case 'totalCost':
            userData[userId].totalCost = messageText;
            userSteps[userId] = 'initialPayment';
            ctx.reply('Введите сумму первоначального платежа:');
            break;
        case 'initialPayment':
            userData[userId].initialPayment = messageText;
            userData[userId].remainingAmount = userData[userId].totalCost - userData[userId].initialPayment;
            ctx.reply(`Остаток к оплате: ${userData[userId].remainingAmount}`);
            sendConfirmation(ctx, userId);
            userSteps[userId] = 'confirmation';
            break;
    }
});

bot.action(['Диван', 'Кресло', 'Кухонный гарнитур', 'Прихожая', 'Шкаф'], (ctx) => {
    const userId = ctx.from.id;
    userData[userId].product = ctx.match[0];
    userSteps[userId] = 'paymentType';
    ctx.reply('Выберите вариант оплаты:', Markup.inlineKeyboard([
        [{ text: 'Оплачен', callback_data: 'Оплачен' }],
        [{ text: 'В рассрочку', callback_data: 'В рассрочку' }]
    ]));
});

bot.action('Оплачен', (ctx) => {
    const userId = ctx.from.id;
    userData[userId].paymentType = 'Оплачен';
    userSteps[userId] = 'amount';
    ctx.reply('Введите сумму:');
});

bot.action('В рассрочку', (ctx) => {
    const userId = ctx.from.id;
    userData[userId].paymentType = 'В рассрочку';
    userSteps[userId] = 'totalCost';
    ctx.reply('Введите стоимость товара:');
});

async function sendConfirmation(ctx, userId) {
    const report = `
Дата продажи: ${userData[userId].saleDate}
ФИО клиента: ${userData[userId].name}
Номер телефона: ${userData[userId].phone}
Адрес клиента: ${userData[userId].address}
Покупка: ${userData[userId].product}
Способ оплаты: ${userData[userId].paymentType}
${userData[userId].paymentType === 'Оплачен' ? `Сумма платежа: ${userData[userId].amount}` : `
Сумма товара: ${userData[userId].totalCost}
Первоначальный платеж: ${userData[userId].initialPayment}
Остаток к оплате: ${userData[userId].remainingAmount}`}
`;

    ctx.reply(report, Markup.inlineKeyboard([
        [{ text: 'Отправить отчёт', callback_data: 'send_report' }],
        [{ text: 'Редактировать данные', callback_data: 'edit_data' }]
    ]));
}

bot.action('send_report', async (ctx) => {
    const userId = ctx.from.id;
    try {
        await axios.post(process.env.GOOGLE_APPS_SCRIPT_URL, userData[userId]);
        ctx.reply('Ваш отчет отправлен!', mainMenu);
        delete userData[userId];
        delete userSteps[userId];
    } catch (error) {
        console.error('Error sending report:', error);
        ctx.reply('Произошла ошибка при отправке отчета.', mainMenu);
    }
});

bot.action('edit_data', (ctx) => {
    ctx.reply('Что вы хотите исправить?', Markup.inlineKeyboard([
        [{ text: 'Дата продажи', callback_data: 'edit_date' }],
        [{ text: 'ФИО', callback_data: 'edit_name' }],
        [{ text: 'Номер телефона', callback_data: 'edit_phone' }],
        [{ text: 'Адрес клиента', callback_data: 'edit_address' }],
        [{ text: 'Товар', callback_data: 'edit_product' }],
        [{ text: 'Способ оплаты', callback_data: 'edit_payment' }]
    ]));
});

bot.action('edit_date', (ctx) => {
    const userId = ctx.from.id;
    userSteps[userId] = 'enter_date';
    ctx.reply('Введите дату в формате ГГГГ-ММ-ДД:');
});

bot.action('edit_name', (ctx) => {
    const userId = ctx.from.id;
    userSteps[userId] = 'name';
    ctx.reply('Введите ФИО клиента:');
});

bot.action('edit_phone', (ctx) => {
    const userId = ctx.from.id;
    userSteps[userId] = 'phone';
    ctx.reply('Введите номер телефона клиента:');
});

bot.action('edit_address', (ctx) => {
    const userId = ctx.from.id;
    userSteps[userId] = 'address';
    ctx.reply('Введите адрес клиента:');
});

bot.action('edit_product', (ctx) => {
    const userId = ctx.from.id;
    userSteps[userId] = 'product';
    ctx.reply('Выберите товар:', Markup.inlineKeyboard([
        [{ text: 'Диван', callback_data: 'Диван' }],
        [{ text: 'Кресло', callback_data: 'Кресло' }],
        [{ text: 'Кухонный гарнитур', callback_data: 'Кухонный гарнитур' }],
        [{ text: 'Прихожая', callback_data: 'Прихожая' }],
        [{ text: 'Шкаф', callback_data: 'Шкаф' }]
    ]));
});

bot.action('edit_payment', (ctx) => {
    const userId = ctx.from.id;
    userSteps[userId] = 'paymentType';
    ctx.reply('Выберите вариант оплаты:', Markup.inlineKeyboard([
        [{ text: 'Оплачен', callback_data: 'Оплачен' }],
        [{ text: 'В рассрочку', callback_data: 'В рассрочку' }]
    ]));
});

bot.launch();
