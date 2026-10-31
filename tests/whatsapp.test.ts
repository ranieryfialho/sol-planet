import assert from "node:assert/strict";
import { test } from "node:test";
import { instanceName } from "../packages/whatsapp/src/index";

const env = {} as NodeJS.ProcessEnv;

test("o nome da instância identifica quem é: solar-<login>-<id>", () => {
  assert.equal(instanceName(1, "ranieryfialho@gmail.com", env), "solar-ranieryfialho-1");
  assert.equal(instanceName(7, "Maria.Souza+solar@Empresa.com.br", env), "solar-mariasouzasolar-7");
});

test("telefone não vai inteiro para o nome: só os 4 últimos dígitos", () => {
  assert.equal(instanceName(3, "+55 85 99998-5587", env), "solar-tel5587-3");
});

test("login vazio ou só símbolos cai em 'conta' e o id mantém o nome único", () => {
  assert.equal(instanceName(2, "@@@", env), "solar-conta-2");
  assert.notEqual(instanceName(1, "a@x.com", env), instanceName(2, "a@x.com", env));
});

test("prefixo configurável e login longo é cortado", () => {
  assert.equal(instanceName(1, "ab@x.com", { EVOLUTION_INSTANCE_PREFIX: "casa" } as NodeJS.ProcessEnv), "casa-ab-1");
  assert.equal(instanceName(1, `${"a".repeat(40)}@x.com`, env), `solar-${"a".repeat(24)}-1`);
});
