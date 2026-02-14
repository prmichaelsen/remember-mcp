/**
 * Centralized error handling utilities for MCP tools
 * Provides consistent error logging and formatting across all tools
 */

import { logger } from './logger.js';

/**
 * Error context for detailed logging
 */
export interface ErrorContext {
  toolName: string;
  userId?: string;
  operation?: string;
  [key: string]: any;
}

/**
 * Format error with detailed context for logging and throwing
 * 
 * @param error - The caught error
 * @param context - Additional context about where/why the error occurred
 * @returns Formatted error message with stack trace and context
 */
export function formatDetailedError(error: unknown, context: ErrorContext): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  // Log detailed error information
  logger.error(`${context.toolName} failed:`, {
    error: errorMessage,
    stack: errorStack,
    ...context,
  });
  
  // Build detailed error message
  const contextStr = Object.entries(context)
    .filter(([key]) => key !== 'toolName')
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
  
  return (
    `Failed to ${context.operation || 'execute'}: ${errorMessage}` +
    (errorStack ? `\n\nStack trace:\n${errorStack}` : '') +
    (contextStr ? `\n\nContext: ${contextStr}` : '')
  );
}

/**
 * Handle tool execution error with detailed logging
 * Logs the error and throws a formatted error with full context
 * 
 * @param error - The caught error
 * @param context - Additional context about the operation
 * @throws Error with detailed message including stack trace and context
 */
export function handleToolError(error: unknown, context: ErrorContext): never {
  const detailedMessage = formatDetailedError(error, context);
  throw new Error(detailedMessage);
}

/**
 * Wrap an async operation with detailed error handling
 * 
 * @param operation - The async operation to execute
 * @param context - Error context for logging
 * @returns Result of the operation
 * @throws Error with detailed context if operation fails
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: ErrorContext
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    handleToolError(error, context);
  }
}
