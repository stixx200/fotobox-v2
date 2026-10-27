//! Restart/relaunch policy for the embedded API, kept free of I/O so it can be
//! unit tested. The failure count only resets after a healthy check, so an API
//! that keeps dying right after a "successful" restart still escalates.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Action {
    /// API is healthy or still starting; nothing to do.
    None,
    /// Restart the API process in place.
    RestartApi,
    /// Give up and relaunch the whole app.
    RelaunchApp,
}

/// Result of one health check.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Check {
    /// The API answered.
    Healthy,
    /// The process runs but the API doesn't answer (yet).
    NotResponding,
    /// The process is gone.
    Exited,
}

#[derive(Debug)]
pub struct Supervisor {
    max_failures: u32,
    failures: u32,
    /// Checks an API that has not answered since its (re)start may miss:
    /// the first start on a kiosk PC can take minutes (virus scan of the
    /// bundled files, database migrations).
    startup_grace: u32,
    grace_left: u32,
}

impl Supervisor {
    pub fn new(max_failures: u32, startup_grace: u32) -> Self {
        Self {
            max_failures,
            failures: 0,
            startup_grace,
            grace_left: startup_grace,
        }
    }

    pub fn failures(&self) -> u32 {
        self.failures
    }

    /// Record the outcome of one health check and decide what to do.
    pub fn on_check(&mut self, check: Check) -> Action {
        match check {
            Check::Healthy => {
                self.failures = 0;
                // Once up, a missed check means trouble, not a slow start.
                self.grace_left = 0;
                return Action::None;
            }
            Check::NotResponding if self.grace_left > 0 => {
                self.grace_left -= 1;
                return Action::None;
            }
            Check::NotResponding | Check::Exited => {}
        }
        self.failures += 1;
        // The restarted API gets the same time to start.
        self.grace_left = self.startup_grace;
        if self.failures >= self.max_failures {
            Action::RelaunchApp
        } else {
            Action::RestartApi
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn healthy_checks_do_nothing() {
        let mut s = Supervisor::new(3, 0);
        assert_eq!(s.on_check(Check::Healthy), Action::None);
        assert_eq!(s.on_check(Check::Healthy), Action::None);
    }

    #[test]
    fn restarts_then_resets_after_recovery() {
        let mut s = Supervisor::new(3, 0);
        assert_eq!(s.on_check(Check::NotResponding), Action::RestartApi);
        assert_eq!(s.failures(), 1);
        assert_eq!(s.on_check(Check::Healthy), Action::None);
        assert_eq!(s.failures(), 0);
    }

    #[test]
    fn relaunches_when_restarts_do_not_help() {
        let mut s = Supervisor::new(3, 0);
        assert_eq!(s.on_check(Check::NotResponding), Action::RestartApi);
        assert_eq!(s.on_check(Check::NotResponding), Action::RestartApi);
        assert_eq!(s.on_check(Check::NotResponding), Action::RelaunchApp);
    }

    #[test]
    fn waits_for_a_slow_start() {
        let mut s = Supervisor::new(3, 2);
        assert_eq!(s.on_check(Check::NotResponding), Action::None);
        assert_eq!(s.on_check(Check::NotResponding), Action::None);
        assert_eq!(s.on_check(Check::NotResponding), Action::RestartApi);
        // The restarted API gets the grace period again.
        assert_eq!(s.on_check(Check::NotResponding), Action::None);
        assert_eq!(s.on_check(Check::Healthy), Action::None);
    }

    #[test]
    fn restarts_an_exited_api_right_away() {
        let mut s = Supervisor::new(3, 2);
        assert_eq!(s.on_check(Check::Exited), Action::RestartApi);
    }

    #[test]
    fn no_grace_once_the_api_was_up() {
        let mut s = Supervisor::new(3, 2);
        assert_eq!(s.on_check(Check::Healthy), Action::None);
        assert_eq!(s.on_check(Check::NotResponding), Action::RestartApi);
    }
}
