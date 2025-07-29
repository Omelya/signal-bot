# Shared Module Documentation

Shared модуль містить спільні компоненти, типи, утиліти та конфігурації, які використовуються в усій архітектурі бота.

## 📁 Структура

```
src/shared/
├── types/              # Типи TypeScript
│   ├── AppConfig.types.ts
│   ├── Cache.types.ts
│   ├── CircuitBreaker.ts
│   ├── ConfigurationWatcher.types.ts
│   ├── DIContainer.types.ts
│   ├── Encryption.types.ts
│   ├── EventBus.types.ts
│   ├── Exchange.types.ts
│   ├── HealthCheck.types.ts
│   ├── IdGenerator.types.ts
│   ├── Lock.types.ts
│   ├── Logger.types.ts
│   ├── Market.types.ts
│   ├── Metrics.types.ts
│   ├── NotificationChannel.types.ts
│   ├── Pair.types.ts
│   ├── Queue.types.ts
│   ├── RateLimit.types.ts
│   ├── RetryPolicy.types.ts
│   ├── Scheduler.types.ts
│   ├── Serializer.types.ts
│   ├── Signal.types.ts
│   ├── Strategy.types.ts
│   ├── TimeProvider.types.ts
│   └── Validator.types.ts
├── constants/          # Константи додатка
│   ├── TradingConstants.ts
│   ├── ErrorConstants.ts
│   └── EventConstants.ts
├── utils/              # Утиліти
│   ├── DateUtil.ts
│   ├── MathUtil.ts
│   ├── ValidationUtil.ts
│   └── StringUtil.ts
├── errors/             # Класи помилок
│   ├── DomainErrors.ts
│   └── InfrastructureErrors.ts
├── container/          # Dependency Injection
│   ├── DIContainer.ts
│   └── ServiceProvider.ts
├── config/             # Конфігурації
│   ├── AppConfig.ts
│   └── ExchangeConfigs.ts
└── index.ts           # Головний експорт
```

## 🔧 Основні компоненти

### Типи (Types)

Визначають структури даних для всіх доменів:

- **Exchange.types.ts** - типи для бірж та таймфреймів
- **Market.types.ts** - типи для ринкових даних
- **Signal.types.ts** - типи для торгових сигналів
- **Strategy.types.ts** - типи для торгових стратегій
- **Pair.types.ts** - типи для торгових пар

### Константи (Constants)

- **TradingConstants.ts** - торгові константи та обмеження
- **ErrorConstants.ts** - коди помилок та повідомлення
- **EventConstants.ts** - константи подій та їх типи

### Утиліти (Utils)

- **DateUtil.ts** - робота з датами та часом
- **MathUtil.ts** - математичні обчислення
- **ValidationUtil.ts** - валідація даних
- **StringUtil.ts** - робота з рядками

### Помилки (Errors)

- **DomainErrors.ts** - помилки доменного шару
- **InfrastructureErrors.ts** - помилки інфраструктурного шару

### Dependency Injection

- **DIContainer.ts** - контейнер залежностей
- **ServiceProvider.ts** - провайдер сервісів

### Конфігурації (Config)

- **AppConfig.ts** - конфігурація додатка
- **ExchangeConfigs.ts** - конфігурації бірж

## 💡 Використання

### Імпорт типів

```typescript
import { 
    ExchangeType, 
    TimeFrame, 
    SignalDirection,
    PairCategory 
} from '@shared/types';
```

### Використання утилітів

```typescript
import { ValidationUtil, DateUtil, MathUtil } from '@shared/utils';

// Валідація
ValidationUtil.required(value, 'fieldName');
ValidationUtil.positiveNumber(amount, 'amount');

// Дати
const now = DateUtil.now();
const formatted = DateUtil.formatForDisplay(new Date());

// Математика
const average = MathUtil.movingAverage(values, 20);
const volatility = MathUtil.standardDeviation(prices);
```

### Конфігурація

```typescript
import { AppConfig, ExchangeConfigs } from '@shared/config';

const appConfig = AppConfig.fromEnvironment();
const exchangeConfigs = ExchangeConfigs.fromEnvironment();
```

### Dependency Injection

```typescript
import { DIContainer, ServiceProvider } from '@shared/container';

const container = new DIContainer();
ServiceProvider.configureServices(container);

const logger = container.get<ILogger>('logger');
```

### Константи

```typescript
import { 
    TRADING_CONSTANTS, 
    ERROR_CODES, 
    EVENT_TYPES 
} from '@shared/constants';

const maxRisk = TRADING_CONSTANTS.MAX_RISK_PER_TRADE;
const errorCode = ERROR_CODES.VALIDATION_ERROR;
const eventType = EVENT_TYPES.SIGNAL_GENERATED;
```

## 🎯 Принципи дизайну

### 1. Immutability
Всі типи та константи є незмінними (readonly).

### 2. Type Safety
Використання строгої типізації TypeScript для всіх компонентів.

### 3. Single Responsibility
Кожен модуль має одну чітко визначену відповідальність.

### 4. Reusability
Компоненти розроблені для повторного використання в різних шарах.

### 5. Error Handling
Комплексна система обробки помилок з типізованими винятками.

## 📊 Value Objects

Shared модуль також містить Value Objects для доменної логіки:

### Price

```typescript
import { Price } from '@shared/valueObjects';

const price = Price.fromNumber(50000, 'USDT');
const formatted = price.format(2); // $50000.00
```

### Volume

```typescript
import { Volume } from '@shared/valueObjects';

const volume = Volume.fromNumber(1500000);
const display = volume.format(); // 1.5M USD
```

### TechnicalIndicators

```typescript
import { TechnicalIndicators } from '@shared/valueObjects';

const indicators = TechnicalIndicators.create(values);
const signal = indicators.getOverallSignal();
```

### TimeFrame

```typescript
import { TimeFrame } from '@shared/valueObjects';

const timeframe = TimeFrame.fifteenMinutes();
const minutes = timeframe.getMinutes(); // 15
const strategy = timeframe.getStrategyType(); // 'INTRADAY'
```

## 🔍 Validation

Потужна система валідації з типізованими помилками:

```typescript
import { ValidationUtil } from '@shared/utils';

try {
    ValidationUtil.required(value, 'API Key');
    ValidationUtil.positiveNumber(amount, 'Trade Amount');
    ValidationUtil.tradingPair(pair, 'Trading Pair');
    ValidationUtil.percentage(confidence, 'Confidence');
} catch (error) {
    if (error instanceof ValidationError) {
        console.error('Validation failed:', error.message);
    }
}
```

## 📈 Events

Система подій для міжшарової комунікації:

```typescript
import { 
    EVENT_TYPES, 
    EventUtils, 
    EventCategory,
    EventSeverity 
} from '@shared/constants';

// Створення події
const event = EventUtils.createSuccessEvent(
    EVENT_TYPES.SIGNAL_GENERATED,
    { signalId: '123', pair: 'BTC/USDT' },
    'SignalGenerator'
);

// Фільтрація подій
const filter = {
    categories: [EventCategory.SIGNAL],
    severities: [EventSeverity.INFO]
};
```

## ⚙️ Configuration

Гнучка система конфігурації з валідацією:

```typescript
import { AppConfig } from '@shared/config';

const config = AppConfig.fromEnvironment();

// Перевірка середовища
if (config.isProduction()) {
    // Production logic
}

// Отримання поточної торгової конфігурації
const tradingConfig = config.getCurrentTradingConfig();
```

## 🛡️ Error Handling

Структурована обробка помилок:

```typescript
import { 
    DomainError, 
    InfrastructureError,
    ErrorFormatter 
} from '@shared/errors';

try {
    // Some operation
} catch (error) {
    if (error instanceof DomainError) {
        // Handle domain error
    } else if (error instanceof InfrastructureError) {
        // Handle infrastructure error
    }
    
    // Format for user
    const userMessage = ErrorFormatter.getUserFriendlyMessage(error);
}
```

## 🔄 Dependency Injection

Зручна система управління залежностями:

```typescript
import { DIContainer, ServiceProvider } from '@shared/container';

// Створення контейнера
const container = ServiceProvider.createContainer();

// Отримання сервісів
const exchangeFactory = container.get('exchangeFactory');
const signalRepository = container.get('signalRepository');

// Валідація контейнера
const validation = container.validate();
if (!validation.valid) {
    console.error('DI validation errors:', validation.errors);
}
```

Shared модуль є фундаментом всієї архітектури та забезпечує консистентність, типобезпеку та повторне використання коду в усіх шарах додатка.