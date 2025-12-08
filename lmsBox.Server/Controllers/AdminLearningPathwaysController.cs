using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using lmsbox.infrastructure.Data;
using lmsbox.domain.Models;
using lmsBox.Server.Services;
using System.Security.Claims;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AdminLearningPathwaysController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IEmailService _emailService;
    private readonly ILogger<AdminLearningPathwaysController> _logger;

    public AdminLearningPathwaysController(
        ApplicationDbContext context,
        IEmailService emailService,
        ILogger<AdminLearningPathwaysController> logger)
    {
        _context = context;
        _emailService = emailService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetLearningPathways(
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string sortBy = "name",
        [FromQuery] string sortOrder = "asc")
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        // Validate pagination parameters
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 10;
        if (pageSize > 100) pageSize = 100;

        var query = _context.LearningPathways
            .Include(lp => lp.Organisation)
            .Include(lp => lp.CreatedByUser)
            .Include(lp => lp.LearnerProgresses)
            .Include(lp => lp.PathwayCourses)
                .ThenInclude(pc => pc.Course)
            .AsQueryable();

        // Search filter
        if (!string.IsNullOrEmpty(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(lp => 
                lp.Title.ToLower().Contains(searchLower) || 
                (lp.Description != null && lp.Description.ToLower().Contains(searchLower)));
        }

        // Get total count before pagination
        var totalCount = await query.CountAsync();
        
        // Apply sorting
        var sortByLower = sortBy.ToLower();
        var sortOrderLower = sortOrder.ToLower();

        query = sortByLower switch
        {
            "name" => sortOrderLower == "desc" 
                ? query.OrderByDescending(lp => lp.Title) 
                : query.OrderBy(lp => lp.Title),
            "createdat" => sortOrderLower == "desc" 
                ? query.OrderByDescending(lp => lp.CreatedAt) 
                : query.OrderBy(lp => lp.CreatedAt),
            "membercount" => sortOrderLower == "desc" 
                ? query.OrderByDescending(lp => lp.LearnerProgresses.Count()) 
                : query.OrderBy(lp => lp.LearnerProgresses.Count()),
            "coursecount" => sortOrderLower == "desc" 
                ? query.OrderByDescending(lp => lp.PathwayCourses.Count()) 
                : query.OrderBy(lp => lp.PathwayCourses.Count()),
            _ => query.OrderBy(lp => lp.Title)
        };

        // Apply pagination
        var pathways = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(lp => new
            {
                id = lp.Id,
                name = lp.Title,
                description = lp.Description,
                createdAt = lp.CreatedAt,
                createdBy = lp.CreatedByUser!.UserName,
                memberCount = lp.LearnerProgresses.Count(),
                courseCount = lp.PathwayCourses.Count(),
                courses = lp.PathwayCourses.Select(pc => new
                {
                    id = pc.Course!.Id,
                    title = pc.Course.Title,
                    assignedAt = pc.AddedAt
                }).ToList()
            })
            .ToListAsync();

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        return Ok(new
        {
            items = pathways,
            pagination = new
            {
                currentPage = page,
                pageSize,
                totalPages,
                totalCount,
                hasNextPage = page < totalPages,
                hasPreviousPage = page > 1
            }
        });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<object>> GetLearningPathway(string id)
    {
        var pathway = await _context.LearningPathways
            .Include(lp => lp.Organisation)
            .Include(lp => lp.CreatedByUser)
            .Include(lp => lp.LearnerProgresses)
                .ThenInclude(lpp => lpp.User)
            .Include(lp => lp.PathwayCourses)
                .ThenInclude(pc => pc.Course)
            .FirstOrDefaultAsync(lp => lp.Id == id);

        if (pathway == null)
        {
            return NotFound();
        }

        return Ok(new
        {
            id = pathway.Id,
            name = pathway.Title,
            description = pathway.Description,
            createdAt = pathway.CreatedAt,
            createdBy = pathway.CreatedByUser!.UserName,
            members = pathway.LearnerProgresses
                .Select(lpp => new
                {
                    userId = lpp.UserId,
                    userName = lpp.User!.UserName,
                    email = lpp.User.Email,
                    joinedAt = lpp.EnrolledAt
                }).ToList(),
            courses = pathway.PathwayCourses.Select(pc => new
            {
                id = pc.Course!.Id,
                title = pc.Course.Title,
                description = pc.Course.Description,
                assignedAt = pc.AddedAt,
                sequenceOrder = pc.SequenceOrder
            }).ToList()
        });
    }

    [HttpPost]
    public async Task<ActionResult<object>> CreateLearningPathway([FromBody] CreateLearningPathwayRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null || user.OrganisationID == 0)
        {
            return BadRequest(new { message = "User must belong to an organization" });
        }

        var pathway = new LearningPathway
        {
            Id = lmsbox.domain.Utils.ShortGuid.Generate(),
            Title = request.Name,
            Description = request.Description,
            ShortDescription = request.Description,
            Category = "General",
            IsActive = true,
            OrganisationId = user.OrganisationID ?? 0,
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        _context.LearningPathways.Add(pathway);
        await _context.SaveChangesAsync();

        // Add courses if provided
        if (request.CourseIds?.Any() == true)
        {
            int sequenceOrder = 1;
            var pathwayCourses = request.CourseIds.Select(courseId => new PathwayCourse
            {
                LearningPathwayId = pathway.Id,
                CourseId = courseId,
                SequenceOrder = sequenceOrder++,
                IsMandatory = true,
                AddedAt = DateTime.UtcNow
            }).ToList();

            _context.PathwayCourses.AddRange(pathwayCourses);
            await _context.SaveChangesAsync();
        }

        // Add users if provided
        if (request.UserIds?.Any() == true)
        {
            var learnerProgresses = request.UserIds.Select(userId => new LearnerPathwayProgress
            {
                LearningPathwayId = pathway.Id,
                UserId = userId,
                EnrolledAt = DateTime.UtcNow,
                ProgressPercent = 0,
                CompletedCourses = 0,
                TotalCourses = request.CourseIds?.Count ?? 0
            }).ToList();

            _context.LearnerPathwayProgresses.AddRange(learnerProgresses);
            await _context.SaveChangesAsync();

            // Send email notifications to assigned users
            try
            {
                // Fetch pathway details and courses
                var pathwayWithCourses = await _context.LearningPathways
                    .Where(p => p.Id == pathway.Id)
                    .Include(p => p.PathwayCourses)
                        .ThenInclude(pc => pc.Course)
                    .FirstOrDefaultAsync();

                var courseNames = pathwayWithCourses?.PathwayCourses
                    .Select(pc => pc.Course!.Title)
                    .ToList() ?? new List<string>();

                var organisation = await _context.Organisations.FirstOrDefaultAsync();
                var portalUrl = $"{Request.Scheme}://{Request.Host}";

                // Fetch user details and send emails
                var users = await _context.Users
                    .Where(u => request.UserIds.Contains(u.Id))
                    .ToListAsync();

                foreach (var userToEmail in users)
                {
                    try
                    {
                        await _emailService.SendPathwayAssignmentEmailAsync(
                            userToEmail.Email!,
                            organisation!.Id.ToString(),
                            portalUrl,
                            new List<string> { pathway.Title },
                            courseNames,
                            userToEmail.FirstName
                        );

                        _logger.LogInformation("Pathway assignment notification sent to {Email} for pathway {PathwayId}", 
                            userToEmail.Email, pathway.Id);
                    }
                    catch (Exception emailEx)
                    {
                        _logger.LogError(emailEx, "Failed to send pathway assignment notification to {Email}", userToEmail.Email);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending pathway assignment notifications for pathway {PathwayId}", pathway.Id);
            }
        }

        return CreatedAtAction(nameof(GetLearningPathway), new { id = pathway.Id }, new
        {
            pathway.Id,
            Name = pathway.Title,
            pathway.Description,
            pathway.CreatedAt
        });
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateLearningPathway(string id, [FromBody] UpdateLearningPathwayRequest request)
    {
        var pathway = await _context.LearningPathways
            .Include(lp => lp.PathwayCourses)
            .Include(lp => lp.LearnerProgresses)
            .FirstOrDefaultAsync(lp => lp.Id == id);

        if (pathway == null)
        {
            return NotFound();
        }

        // Update basic properties
        pathway.Title = request.Name;
        pathway.Description = request.Description;
        pathway.ShortDescription = request.Description;

        // Track new courses for notification
        List<string>? newCourseIds = null;
        List<string>? newCourseNames = null;

        // Update courses
        if (request.CourseIds != null)
        {
            // Get existing course IDs to detect new additions
            var existingCourseIds = pathway.PathwayCourses.Select(pc => pc.CourseId).ToList();
            newCourseIds = request.CourseIds.Except(existingCourseIds).ToList();

            // Remove existing courses
            _context.PathwayCourses.RemoveRange(pathway.PathwayCourses);

            // Add new courses
            int sequenceOrder = 1;
            var pathwayCourses = request.CourseIds.Select(courseId => new PathwayCourse
            {
                LearningPathwayId = pathway.Id,
                CourseId = courseId,
                SequenceOrder = sequenceOrder++,
                IsMandatory = true,
                AddedAt = DateTime.UtcNow
            }).ToList();

            _context.PathwayCourses.AddRange(pathwayCourses);

            // If there are new courses and existing learners, prepare to notify them
            if (newCourseIds.Any() && pathway.LearnerProgresses.Any())
            {
                var newCourses = await _context.Courses
                    .Where(c => newCourseIds.Contains(c.Id))
                    .ToListAsync();
                newCourseNames = newCourses.Select(c => c.Title).ToList();
            }
        }

        // Update users
        if (request.UserIds != null)
        {
            // Get existing user IDs to determine new assignments
            var existingUserIds = pathway.LearnerProgresses.Select(lp => lp.UserId).ToList();
            var newUserIds = request.UserIds.Except(existingUserIds).ToList();

            // Remove existing users
            _context.LearnerPathwayProgresses.RemoveRange(pathway.LearnerProgresses);

            // Add new users
            var learnerProgresses = request.UserIds.Select(userId => new LearnerPathwayProgress
            {
                LearningPathwayId = pathway.Id,
                UserId = userId,
                EnrolledAt = DateTime.UtcNow,
                ProgressPercent = 0,
                CompletedCourses = 0,
                TotalCourses = request.CourseIds?.Count ?? 0
            }).ToList();

            _context.LearnerPathwayProgresses.AddRange(learnerProgresses);

            await _context.SaveChangesAsync();

            // Send email notifications to newly assigned users
            if (newUserIds.Any())
            {
                try
                {
                    // Fetch updated pathway with courses
                    var pathwayWithCourses = await _context.LearningPathways
                        .Where(p => p.Id == pathway.Id)
                        .Include(p => p.PathwayCourses)
                            .ThenInclude(pc => pc.Course)
                        .FirstOrDefaultAsync();

                    var courseNames = pathwayWithCourses?.PathwayCourses
                        .Select(pc => pc.Course!.Title)
                        .ToList() ?? new List<string>();

                    var organisation = await _context.Organisations.FirstOrDefaultAsync();
                    var portalUrl = $"{Request.Scheme}://{Request.Host}";

                    // Fetch newly assigned user details
                    var newUsers = await _context.Users
                        .Where(u => newUserIds.Contains(u.Id))
                        .ToListAsync();

                    foreach (var userToEmail in newUsers)
                    {
                        try
                        {
                            await _emailService.SendPathwayAssignmentEmailAsync(
                                userToEmail.Email!,
                                organisation!.Id.ToString(),
                                portalUrl,
                                new List<string> { pathway.Title },
                                courseNames,
                                userToEmail.FirstName
                            );

                            _logger.LogInformation("Pathway assignment notification sent to {Email} for pathway {PathwayId}", 
                                userToEmail.Email, pathway.Id);
                        }
                        catch (Exception emailEx)
                        {
                            _logger.LogError(emailEx, "Failed to send pathway assignment notification to {Email}", userToEmail.Email);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error sending pathway assignment notifications for pathway {PathwayId}", pathway.Id);
                }
            }
        }
        else
        {
            await _context.SaveChangesAsync();
        }

        // Notify existing learners about new courses added to pathway
        if (newCourseNames?.Any() == true && pathway.LearnerProgresses.Any())
        {
            try
            {
                var organisation = await _context.Organisations.FirstOrDefaultAsync();
                var portalUrl = $"{Request.Scheme}://{Request.Host}";

                // Get all users assigned to this pathway
                var assignedUserIds = pathway.LearnerProgresses.Select(lp => lp.UserId).ToList();
                var assignedUsers = await _context.Users
                    .Where(u => assignedUserIds.Contains(u.Id))
                    .ToListAsync();

                foreach (var user in assignedUsers)
                {
                    try
                    {
                        await _emailService.SendNewCourseAccessEmailAsync(
                            user.Email!,
                            organisation!.Id.ToString(),
                            portalUrl,
                            newCourseNames,
                            pathway.Title,
                            user.FirstName
                        );

                        _logger.LogInformation("New course notification sent to {Email} for {CourseCount} new course(s) in pathway {PathwayId}", 
                            user.Email, newCourseNames.Count, pathway.Id);
                    }
                    catch (Exception emailEx)
                    {
                        _logger.LogError(emailEx, "Failed to send new course notification to {Email}", user.Email);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending new course notifications for pathway {PathwayId}", pathway.Id);
            }
        }

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteLearningPathway(string id)
    {
        var pathway = await _context.LearningPathways.FindAsync(id);

        if (pathway == null)
        {
            return NotFound();
        }

        _context.LearningPathways.Remove(pathway);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}

public class CreateLearningPathwayRequest
{
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public List<string>? CourseIds { get; set; }
    public List<string>? UserIds { get; set; }
}

public class UpdateLearningPathwayRequest
{
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public List<string>? CourseIds { get; set; }
    public List<string>? UserIds { get; set; }
}