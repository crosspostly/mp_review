# Automatic Authorization Request for Google Apps Script Triggers

## Problem Description

When users opened the Google Sheets with the Multi-Store Auto-Reply Manager, they encountered permission errors like:

```
[onOpen] ⚠️ Ошибка синхронизации триггеров: Указанных разрешений недостаточно для звонка пользователю ScriptApp.getProjectTriggers. Требуемые разрешения: https://www.googleapis.com/auth/script.scriptapp
```

This error occurred because the script tried to access `ScriptApp.getProjectTriggers()` without having the necessary `script.scriptapp` permission.

## Solution Overview

The fix implements a comprehensive authorization handling system that:

1. **Detects permission errors** automatically
2. **Prompts users for authorization** with clear instructions
3. **Provides fallback options** for manual authorization
4. **Gracefully degrades functionality** when authorization is denied
5. **Maintains backward compatibility** with existing functionality

## Key Features

### 1. Authorization Helper Functions

- **`hasScriptAppPermissions()`**: Safely checks if the required permissions are available
- **`safeGetProjectTriggers()`**: Wrapper that triggers authorization flow on permission errors
- **`requestScriptAppAuthorization()`**: Shows detailed authorization prompt to users
- **`forceAuthorizationRequest()`**: Attempts to trigger Google's authorization dialog
- **`requestManualAuthorization()`**: Manual authorization function for script editor

### 2. User-Friendly Authorization Flow

When a permission error occurs:

1. User sees a detailed dialog explaining what permissions are needed
2. Clear instructions on how to grant permissions
3. Automatic attempt to trigger Google's authorization dialog
4. Fallback instructions for manual authorization if automatic fails
5. Clear explanation of limitations if user declines

### 3. Graceful Degradation

If users decline authorization:
- ✅ **Still works**: Manual review processing, sending prepared answers, all core functionality
- ❌ **Limited**: Automatic trigger management, trigger synchronization
- 🔄 **Recoverable**: Users can authorize later via menu option

### 4. Menu Integration

Added new menu item: `🔄 Управление автозапуском` → `🔑 Запросить авторизацию триггеров`

Users can request authorization at any time without having to wait for errors.

## Technical Implementation

### Safe Permission Checks

All functions that use `ScriptApp.getProjectTriggers()` now use `safeGetProjectTriggers()`:

```javascript
function safeGetProjectTriggers() {
  try {
    return ScriptApp.getProjectTriggers();
  } catch (e) {
    if (e.message && e.message.includes('script.scriptapp')) {
      log(`[Auth] ❌ Недостаточно разрешений для работы с триггерами: ${e.message}`);
      requestScriptAppAuthorization();
      return null;
    }
    throw e; // Re-throw other errors
  }
}
```

### Updated Functions

All trigger management functions have been updated:
- `onOpen()` - now safely checks permissions before sync
- `deleteStoreTrigger()` 
- `syncAllStoreTriggers()`
- `deleteAllTriggers()`
- `createWarmupTrigger()`
- `deleteWarmupTrigger()`
- `deletePerStoreTriggersInternal()`

### Error Handling

Each function includes proper null checks:

```javascript
const triggers = safeGetProjectTriggers();
if (!triggers) {
  log('❌ Нет разрешений для управления триггерами - требуется авторизация');
  return; // or appropriate fallback behavior
}
```

## Benefits

1. **No More Crashes**: Script continues working even without trigger permissions
2. **Better User Experience**: Clear guidance instead of cryptic error messages  
3. **Self-Service**: Users can resolve authorization issues themselves
4. **Proactive Management**: Authorization can be requested before errors occur
5. **Maintains Functionality**: Core features work regardless of trigger permissions

## Required Permission

The fix specifically handles the `https://www.googleapis.com/auth/script.scriptapp` permission, which is required for:
- Reading project triggers (`ScriptApp.getProjectTriggers()`)
- Creating new triggers (`ScriptApp.newTrigger()`)
- Deleting triggers (`ScriptApp.deleteTrigger()`)

## Usage Instructions

### For Users Experiencing Permission Errors:

1. **Automatic Flow**: When error occurs, follow the dialog instructions
2. **Manual Flow**: Use menu `🔄 Управление автозапуском` → `🔑 Запросить авторизацию триггеров`
3. **Script Editor Flow**: Run `requestManualAuthorization()` function manually

### For Developers:

The authorization system is fully automated. Key functions to be aware of:
- Always use `safeGetProjectTriggers()` instead of `ScriptApp.getProjectTriggers()`
- Check for `null` returns from safe functions
- Provide appropriate fallback behavior when permissions are missing

## Testing

The fix has been tested for:
- ✅ Proper error detection and handling
- ✅ User interface flow and instructions
- ✅ Graceful degradation when permissions denied
- ✅ Backward compatibility with existing functionality
- ✅ Menu integration and manual authorization options

## Files Changed

- `code.gs` - Main implementation with authorization helpers and updated trigger functions

## Related Issues

This fix resolves the Google Apps Script permission errors that were preventing:
- Automatic trigger synchronization on spreadsheet open
- Manual trigger management operations
- Store-specific trigger creation and deletion

The solution ensures the application continues to work for its primary purpose (review processing) while providing a clear path to full functionality through proper authorization.