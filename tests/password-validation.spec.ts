import { expect, test } from '@playwright/test';
import { passwordField } from '../src/lib/auth/validation';
for (const length of [8,16]) {
 test(`새 비밀번호 ${length}자 허용`,()=>{
  const password='A1'+'x'.repeat(length-2);
  expect(passwordField({password})).toBe(password);
 });
}
for (const password of ['A1xxxxx','A1'+'x'.repeat(15),'abcdefgh','12345678']) {
 test(`규칙 위반 비밀번호 거부: ${password.length}자 ${password[0]}`,()=>{
  expect(()=>passwordField({password})).toThrow();
 });
}
