//! Restart/relaunch policy for the embedded API, kept free of I/O so it can be
//! unit tested. The failure count only resets after a healthy check, so an API
//! that keeps dying right after a "successful" restart still escalates.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Action {
    /// API is healthy; nothing to do.
    None,
    /// Restart the API process in place.
    RestartApi,
    /// Give up and relaunch the whole app.
    RelaunchApp,
}

#[derive(Debug)]
pub struct Supervisor {
    max_failures: u32,
    failures: u32,
}

impl Supervisor {
    pub fn new(max_failures: u32) -> Self {
        Self {
            max_failures,
            failures: 0,
        }
    }

    pub fn failures(&self) -> u32 {
        self.failures
    }

    /// Record the outcome of one health check and decide what to do.
    pub fn on_check(&mut self, healthy: bool) -> Action {
        if healthy {
            self.failures = 0;
            return Action::None;
        }
        self.failures += 1;
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
        let mut s = Supervisor::new(3);
        assert_eq!(s.on_check(true), Action::None);
        assert_eq!(s.on_check(true), Action::None);
    }

    #[test]
    fn restarts_then_resets_after_recovery() {
        let mut s = Supervisor::new(3);
        assert_eq!(s.on_check(false), Action::RestartApi);
        assert_eq!(s.failures(), 1);
        assert_eq!(s.on_check(true), Action::None);
        assert_eq!(s.failures(), 0);
    }

    #[test]
    fn relaunches_when_restarts_do_not_help() {
        let mut s = Supervisor::new(3);
        assert_eq!(s.on_check(false), Action::RestartApi);
        assert_eq!(s.on_check(false), Action::RestartApi);
        assert_eq!(s.on_check(false), Action::RelaunchApp);
    }
}
