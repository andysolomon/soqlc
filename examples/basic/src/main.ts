import {
  getAccountById,
  listAccountsByIndustry,
  getAccountWithContacts,
} from "../generated/accounts.js";
import { makeFakeClient } from "./fakeClient.js";

const client = makeFakeClient();

const account = await getAccountById(client, { id: "001AAA" });
console.log("getAccountById ->", account);

const accounts = await listAccountsByIndustry(client, { industry: "Tech", max: 10 });
console.log("listAccountsByIndustry ->", accounts);

const withContacts = await getAccountWithContacts(client, { id: "001AAA" });
console.log("getAccountWithContacts ->", JSON.stringify(withContacts, null, 2));
