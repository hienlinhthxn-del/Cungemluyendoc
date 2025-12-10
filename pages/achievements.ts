export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string; // Emoji
    criteria: (student: any, context?: any) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
    {
        id: 'first_step',
        title: 'Bước Chân Đầu Tiên',
        description: 'Hoàn thành bài học đầu tiên.',
        icon: '🐾',
        criteria: (student) => student.completedLessons === 1,
    },
    {
        id: 'five_lessons',
        title: 'Nhà Thám Hiểm Tí Hon',
        description: 'Hoàn thành 5 bài học.',
        icon: '🗺️',
        criteria: (student) => student.completedLessons === 5,
    },
    {
        id: 'high_scorer',
        title: 'Siêu Sao Điểm Cao',
        description: 'Đạt 90 điểm trở lên trong một bài luyện đọc.',
        icon: '🌟',
        criteria: (student, context) => context?.score >= 90,
    },
    {
        id: 'perfect_score',
        title: 'Nhà Vô Địch',
        description: 'Đạt điểm tuyệt đối 100!',
        icon: '🏆',
        criteria: (student, context) => context?.score === 100,
    },
    {
        id: 'quiz_master',
        title: 'Bậc Thầy Câu Đố',
        description: 'Hoàn thành một bài trắc nghiệm mà không sai câu nào.',
        icon: '🧠',
        criteria: (student, context) => context?.quizCorrect === context?.quizTotal && context?.quizTotal > 0,
    },
];