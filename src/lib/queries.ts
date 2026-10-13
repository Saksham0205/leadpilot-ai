import { queryOptions } from "@tanstack/react-query";
import { getLead, listLeads } from "./leads.functions";

export const leadsQuery = () => queryOptions({ queryKey: ["leads"], queryFn: () => listLeads() });
export const leadQuery = (id: string) => queryOptions({ queryKey: ["leads", id], queryFn: () => getLead({ data: { id } }) });
