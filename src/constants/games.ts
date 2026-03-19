/** 학급 게임 ID (시트 game_id와 동일하게 유지) */
export const GAME_ID_HOME_SEND_ME = 'home_send_me'

export const GAMES_META: Record<
  string,
  { title: string; description: string; studentPath: string }
> = {
  [GAME_ID_HOME_SEND_ME]: {
    title: '집 보내주세요!',
    description: '담임샘을 피해 책상 장애물을 점프·슬라이드로 피하며 최대한 오래 달리세요.',
    studentPath: '/game/home-run',
  },
}
