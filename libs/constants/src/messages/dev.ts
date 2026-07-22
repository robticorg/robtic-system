import { BRANCH_EMOJIS } from "@config";

/** Field definitions for the /project share modal. */
export const PROJECT_SHARE_MODAL = {
    customId: "shareProject",
    title: "Project Sharing",
    fields: {
        title: {
            label: "Project Title",
            description: "A concise title for your project (3-100 characters)",
            placeholder: "A concise title for your project",
        },
        description: {
            label: "Project Description",
            description: "A detailed description of your project (10-2000 characters)",
            placeholder: "A detailed description of your project",
        },
        type: {
            label: "Project Type",
            description: "Select the type of your project",
            placeholder: "Select a project type",
            options: ["Web", "Discord", "Other"],
        },
        link: {
            label: "Project Link",
            description: "A URL to your project (optional)",
            placeholder: "A URL to your project",
        },
    },
} as const;

/** Text for the in-progress project submission container and its edit menu. */
export const PROJECT_FLOW_MESSAGES = {
    selectPlaceholder: "Enhance your project submission...",
    doneButtonLabel: "Done",
    readyPrompt: "Ready to submit?",
    inProgress: (title: string, description: string, projectType: string, type: string) =>
        `**Project Submission in Progress**\n\n**Title:** ${title}\n**Description:** ${description}\n**Type:** ${projectType}\n**Current Type:** ${type}\n\n*Select options below to add more details or click Done.*`,

    menu: {
        tutorial: { label: "Tutorial Link", editDescription: "Edit or Delete Tutorial", addDescription: "Add YouTube Tutorial" },
        additionalLink: { githubLabel: "Add Github Link", otherLabel: "Add Additional Link", hasGithubDescription: "Has Github, add other link", noGithubDescription: "Has other link, add github" },
        env: { label: ".env File", editDescription: "Edit or Delete .env", addDescription: "Add .env file information" },
        image: { label: "Upload Image", editDescription: "Update image", addDescription: "Add preview image" },
    },

    editModals: {
        tutorial: { title: "YouTube Tutorial", label: "YouTube Link", description: "Leave empty to remove", placeholder: "https://youtube.com/..." },
        link: { title: "Additional or Github Link", label: "URL Link", description: "Leave empty to remove", placeholder: "https://..." },
        env: { title: ".env Info", label: ".env Information", description: "Leave empty to remove", placeholder: "KEY=VALUE" },
        image: { title: "Upload Image", label: "Project Image", description: "Upload a screenshot (leave empty to skip)" },
    },

    selectAnOption: "Please select an option.",
    unknownEditOption: "Unknown project edit option.",
} as const;

/** Text for the elevated "share as" prompt shown to owners and full-power staff. */
export const PROJECT_SHARE_TYPE_PROMPT = {
    title: "Select Project Share Type",
    description: "You have high-level permissions. How would you like to share this project?",
    placeholder: "Select sharing type...",
    options: [
        { label: "Share as Member", value: "member" },
        { label: "Share as Dev Staff", value: "developer" },
        { label: "Share as System", value: "system" },
    ],
} as const;

/** Text for the submit/review/publish stage of project sharing. */
export const PROJECT_REVIEW_MESSAGES = {
    notFoundOrSubmitted: "Project not found or already submitted.",
    notFoundInPending: "Project not found in pending list.",
    submittedForReview: "Your project has been submitted for review.",
    reviewSendError: "Error sending for review. Please contact staff.",
    published: (type: string) => `Your ${type} project has been successfully published!`,

    submissionEmbedTitle: "New Project Submission",
    submissionEmbedDescription: (userId: string, title: string, description: string, github: string, other: string, youtube: string, env: string) =>
        `**User:** <@${userId}>\n**Title:** ${title}\n**Description:** ${description}\n**Links:**\nGitHub: ${github}\nOther: ${other}\nYouTube: ${youtube}\n.env: ${env}`,
    submissionNotice: (userId: string) => `New submission from <@${userId}>`,
    noneValue: "None",

    acceptButtonLabel: "Accept",
    refuseButtonLabel: "Refuse",
    acceptModalTitle: "Accept Project",
    refuseModalTitle: "Refuse Project",
    reasonLabel: "Reason",
    reasonDescription: "Sent to the user",

    acceptedDm: (title: string, reason: string) => `**Your project "${title}" has been accepted!**\n**Reason:** ${reason}`,
    refusedDm: (title: string, reason: string) => `**Your project "${title}" has been refused.**\n**Reason:** ${reason}`,
    acceptedLogTitle: "Project Accepted",
    acceptedLogDescription: (title: string, userId: string, reason: string) => `Project **${title}** by <@${userId}> was accepted.\n**Reason:** ${reason}`,
    refusedLogTitle: "Project Refused",
    refusedLogDescription: (title: string, userId: string, reason: string) => `Project **${title}** by <@${userId}> was refused.\n**Reason:** ${reason}`,
    acceptedConfirmation: "Project accepted and published!",
    refusedConfirmation: "Project refused.",
} as const;

/** Text for the published-project browser and its reaction buttons. */
export const PROJECT_BROWSER_MESSAGES = {
    titleByType: {
        member: `${BRANCH_EMOJIS.user} Member Projects`,
        developer: `${BRANCH_EMOJIS.gear} Staff Projects`,
        system: `${BRANCH_EMOJIS["robtic-reading"]} Robtic Projects`,
    } as Record<string, string>,

    descriptionByType: {
        member: "Projects shared by community members. Users can submit projects with `/project share`, then wait for Dev Staff approval before publication.",
        developer: "Projects published directly by the Dev Staff. These are trusted, polished, and professionally delivered.",
        system: "Official Robtic projects released through the Robtic YouTube channel and recognized as official system projects.",
    } as Record<string, string>,

    placeholderByType: {
        member: "Select a member project",
        developer: "Select a staff project",
        system: "Select an official project",
    } as Record<string, string>,

    previousButtonLabel: "Previous",
    nextButtonLabel: "Next",
    topProjectsHeading: "### 🌟 Top Projects",
    noFeaturedProjects: "> No featured projects yet.",
    noDescription: "No description provided.",
    medals: ["🥇", "🥈", "🥉"],

    totalProjectsLabel: (total: number) => `**Total Projects:** ${total}`,
    pageLabel: (page: number, totalPages: number) => `**Page:** ${page}/${totalPages}`,
    searchLabel: (query: string) => `**Search:** ${query}`,
    selectOptionDescription: (projectType: string, views: number, userId: string) => `Type: ${projectType} | Views: ${views} | Author: ${userId}`,

    renderFailedHeading: "Could not render the advanced project panel.",
    renderFailedHint: "Please check project data for invalid values.",

    projectNotFound: "Project not found.",
    invalidProjectAction: "Invalid project action.",
    detailRenderError: "Error displaying project details. Please contact staff.",

    likeButtonLabel: (count: number) => `Like (${count})`,
    viewsButtonLabel: (count: number) => `Views (${count})`,
    dislikeButtonLabel: (count: number) => `Dislike (${count})`,

    projectLinksHeading: "**## Project Links:**",
    viewButtonLabel: "View",
    githubLinkLabel: `**${BRANCH_EMOJIS.share} GitHub:**`,
    liveDemoLinkLabel: `**${BRANCH_EMOJIS.share} Live Demo:**`,
    otherLinkLabel: `**${BRANCH_EMOJIS.share} Other Link:**`,
    youtubeLinkLabel: `**${BRANCH_EMOJIS.youtube} YouTube Tutorial:**`,
    separatorAltText: "Project Separator",
    ownProjectNotice: "this is your project! you can manage it by clicking the button below.",
    configButtonLabel: "Config",
    authorLine: (userId: string, projectType: string, createdAt: string) =>
        `**${BRANCH_EMOJIS.dots}Project Author:** <@${userId}> \n**${BRANCH_EMOJIS.dots}Project Type:** ${projectType} \n**${BRANCH_EMOJIS.dots}Send at:** ${createdAt}`,
    statsLine: (views: number, likes: number) => `> ${BRANCH_EMOJIS.eyes} ${views} • 👍 ${likes}`,

    comingSoon: "Soon ...",
} as const;

/** Asset paths under the branch's GitHub assets base. */
export const PROJECT_ASSET_PATHS = {
    defaultUserIcon: "/utils/discord/user.png",
    separatorLine: "/utils/discord/line.png",
} as const;
