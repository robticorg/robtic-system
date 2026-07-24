import type { StaffOverview } from "@typings/staff-admin";
import { StaffRepository, SubmissionTypeRepository } from "@database/repositories";

/**
 * Everything the Activity's staff panel shows an admin: application types (with open/closed
 * state), submitted applications, and the staff roster. Repository-only, no discord.js.
 */
export async function getStaffOverview(guildId: string): Promise<StaffOverview> {
    const [types, submissions, staff] = await Promise.all([
        SubmissionTypeRepository.list(guildId),
        StaffRepository.findAllSubmissions(),
        StaffRepository.findAll(),
    ]);

    return {
        types: types.map(type => ({
            key: type.key,
            name: type.name,
            isOpen: type.isOpen,
            questionCount: type.questions.length,
        })),
        applications: submissions.map(submission => ({
            userId: submission.userId,
            username: submission.userId, // Replaced with the real username by the API layer.
            department: submission.department,
            isApproved: submission.isApproved,
            answers: submission.questions.map(q => ({ question: q.question, answer: q.answer })),
            createdAt: submission.createdAt.getTime(),
        })),
        staff: staff.map(member => ({
            discordId: member.discordId,
            username: member.username,
            department: member.department,
            position: member.position,
            status: member.status,
            warningCount: member.warnings.length,
            hiredAt: member.hiredAt.getTime(),
        })),
    };
}
