/** 학급 게임 ID (시트 game_id와 동일하게 유지) */
export const GAME_ID_HOME_SEND_ME = 'home_send_me'
export const GAME_ID_TEACHER_QUIZ = 'teacher_quiz'

export const GAMES_META: Record<
  string,
  { title: string; description: string; studentPath: string }
> = {
  [GAME_ID_HOME_SEND_ME]: {
    title: '집 보내주세요!',
    description: '담임샘을 피해 책상 장애물을 점프·슬라이드로 피하며 최대한 오래 달리세요.',
    studentPath: '/game/home-run',
  },
  [GAME_ID_TEACHER_QUIZ]: {
    title: '스승의 날 기념 들샘 모의고사',
    description:
      '담임샘에 대해 얼마나 알고 있나요? 다양한 유형의 문제를 풀며 포인트를 쌓아 1등에 도전하세요!',
    studentPath: '/play/teacher-quiz',
  },
}
