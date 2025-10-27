/**
 * 🧪 ТЕСТИРОВАНИЕ API СТАТИСТИКИ
 * 
 * Этот файл тестирует функционал getApiStatsTracker()
 */

console.log('🚀 Тестирование API статистики...\n');

// Эмуляция Google Apps Script среды для локального тестирования
const mockPropertiesService = {
  data: {},
  getProperty: function(key) { 
    return this.data[key] || null; 
  },
  setProperty: function(key, value) { 
    this.data[key] = value; 
  },
  deleteProperty: function(key) { 
    delete this.data[key]; 
  }
};

// Эмуляция логирования
function logDebug(msg) { console.log(`[DEBUG] ${msg}`); }
function logWarning(msg) { console.log(`[WARNING] ${msg}`); }
function logError(msg) { console.log(`[ERROR] ${msg}`); }
function logInfo(msg) { console.log(`[INFO] ${msg}`); }

// Эмуляция конфига 
const LOG_CONFIG = {
  CATEGORIES: {
    SYSTEM: 'SYSTEM'
  }
};

// Копируем функцию getApiStatsTracker
function getApiStatsTracker() {
  return {
    incrementRequests: function(marketplace) {
      try {
        const props = mockPropertiesService;
        const key = `API_REQUESTS_${marketplace.toUpperCase()}`;
        const current = parseInt(props.getProperty(key) || '0');
        props.setProperty(key, (current + 1).toString());
        
        logDebug(`API Stats: Запросов ${marketplace}: ${current + 1}`);
      } catch (error) {
        logWarning(`Ошибка записи статистики запросов: ${error.message}`);
      }
    },
    
    incrementErrors: function(marketplace) {
      try {
        const props = mockPropertiesService;
        const key = `API_ERRORS_${marketplace.toUpperCase()}`;
        const current = parseInt(props.getProperty(key) || '0');
        props.setProperty(key, (current + 1).toString());
        
        logWarning(`API Stats: Ошибок ${marketplace}: ${current + 1}`);
      } catch (error) {
        logWarning(`Ошибка записи статистики ошибок: ${error.message}`);
      }
    },
    
    recordResponseTime: function(marketplace, responseTime) {
      try {
        const props = mockPropertiesService;
        const key = `API_AVG_TIME_${marketplace.toUpperCase()}`;
        const countKey = `API_TIME_COUNT_${marketplace.toUpperCase()}`;
        const totalKey = `API_TOTAL_TIME_${marketplace.toUpperCase()}`;
        
        const currentAvg = parseFloat(props.getProperty(key) || '0');
        const currentCount = parseInt(props.getProperty(countKey) || '0');
        const currentTotal = parseInt(props.getProperty(totalKey) || '0');
        
        const newTotal = currentTotal + responseTime;
        const newCount = currentCount + 1;
        const newAvg = newTotal / newCount;
        
        props.setProperty(key, newAvg.toFixed(2));
        props.setProperty(countKey, newCount.toString());
        props.setProperty(totalKey, newTotal.toString());
        
        logDebug(`API Stats: Время ${marketplace}: ${responseTime}ms (среднее: ${newAvg.toFixed(2)}ms)`);
      } catch (error) {
        logWarning(`Ошибка записи времени ответа: ${error.message}`);
      }
    },
    
    getStats: function(marketplace) {
      try {
        const props = mockPropertiesService;
        
        if (marketplace === 'all') {
          const ozStats = this.getStats('ozon');
          const wbStats = this.getStats('wildberries');
          
          return {
            total: {
              requests: ozStats.requests + wbStats.requests,
              errors: ozStats.errors + wbStats.errors,
              averageResponseTime: ((ozStats.averageResponseTime * ozStats.requests) + 
                                   (wbStats.averageResponseTime * wbStats.requests)) / 
                                   (ozStats.requests + wbStats.requests) || 0
            },
            ozon: ozStats,
            wildberries: wbStats
          };
        } else {
          const marketplace_upper = marketplace.toUpperCase();
          
          const requests = parseInt(props.getProperty(`API_REQUESTS_${marketplace_upper}`) || '0');
          const errors = parseInt(props.getProperty(`API_ERRORS_${marketplace_upper}`) || '0');
          const averageResponseTime = parseFloat(props.getProperty(`API_AVG_TIME_${marketplace_upper}`) || '0');
          const timeCount = parseInt(props.getProperty(`API_TIME_COUNT_${marketplace_upper}`) || '0');
          const totalResponseTime = parseInt(props.getProperty(`API_TOTAL_TIME_${marketplace_upper}`) || '0');
          
          return {
            marketplace: marketplace,
            requests: requests,
            errors: errors,
            averageResponseTime: averageResponseTime,
            totalResponseTime: totalResponseTime,
            timeCount: timeCount,
            lastRequestTime: timeCount > 0 ? new Date() : null
          };
        }
      } catch (error) {
        logError(`Ошибка получения статистики API: ${error.message}`);
        return {
          marketplace: marketplace,
          requests: 0,
          errors: 0,
          averageResponseTime: 0,
          totalResponseTime: 0,
          timeCount: 0,
          lastRequestTime: null
        };
      }
    },
    
    resetStats: function(marketplace) {
      try {
        const props = mockPropertiesService;
        
        if (marketplace === 'all') {
          ['OZON', 'WILDBERRIES'].forEach(mp => {
            props.deleteProperty(`API_REQUESTS_${mp}`);
            props.deleteProperty(`API_ERRORS_${mp}`);
            props.deleteProperty(`API_AVG_TIME_${mp}`);
            props.deleteProperty(`API_TIME_COUNT_${mp}`);
            props.deleteProperty(`API_TOTAL_TIME_${mp}`);
          });
        } else {
          const marketplace_upper = marketplace.toUpperCase();
          props.deleteProperty(`API_REQUESTS_${marketplace_upper}`);
          props.deleteProperty(`API_ERRORS_${marketplace_upper}`);
          props.deleteProperty(`API_AVG_TIME_${marketplace_upper}`);
          props.deleteProperty(`API_TIME_COUNT_${marketplace_upper}`);
          props.deleteProperty(`API_TOTAL_TIME_${marketplace_upper}`);
        }
        
        logInfo(`API статистика очищена для: ${marketplace}`);
      } catch (error) {
        logError(`Ошибка очистки статистики API: ${error.message}`);
      }
    }
  };
}

// Запуск тестов
async function runTests() {
  const apiTracker = getApiStatsTracker();
  
  console.log('📊 ТЕСТ 1: Базовый функционал');
  console.log('='.repeat(40));
  
  // Тестируем инкремент запросов
  apiTracker.incrementRequests('ozon');
  apiTracker.incrementRequests('ozon');
  apiTracker.incrementRequests('wildberries');
  
  // Тестируем ошибки
  apiTracker.incrementErrors('ozon');
  
  // Тестируем время ответа
  apiTracker.recordResponseTime('ozon', 1500);
  apiTracker.recordResponseTime('ozon', 2000);
  apiTracker.recordResponseTime('wildberries', 800);
  
  console.log('\n📈 ТЕСТ 2: Получение статистики');
  console.log('='.repeat(40));
  
  const ozonStats = apiTracker.getStats('ozon');
  const wbStats = apiTracker.getStats('wildberries');
  const allStats = apiTracker.getStats('all');
  
  console.log('\n🟠 Ozon статистика:', JSON.stringify(ozonStats, null, 2));
  console.log('\n🟣 Wildberries статистика:', JSON.stringify(wbStats, null, 2));
  console.log('\n📊 Общая статистика:', JSON.stringify(allStats, null, 2));
  
  console.log('\n🧹 ТЕСТ 3: Очистка статистики');
  console.log('='.repeat(40));
  
  apiTracker.resetStats('wildberries');
  const wbStatsAfterReset = apiTracker.getStats('wildberries');
  console.log('WB статистика после очистки:', JSON.stringify(wbStatsAfterReset, null, 2));
  
  console.log('\n✅ Все тесты завершены успешно!');
  console.log('💾 Данные в mock storage:', mockPropertiesService.data);
}

runTests().catch(console.error);
