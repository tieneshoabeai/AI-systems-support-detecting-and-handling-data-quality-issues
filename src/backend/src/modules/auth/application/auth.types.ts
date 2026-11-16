/**
 * AUTH — Kiểu dữ liệu tầng application (input/output contract).
 *
 * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.
 * Không import HTTP, không import infrastructure.
 */

export interface RegisterInput { email: string; password: string; first_name: string; last_name: string; role?: 'admin' | 'analyst' }

export interface LoginInput { email: string; password: string; remember_me?: boolean }
