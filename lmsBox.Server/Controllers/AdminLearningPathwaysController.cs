using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using lmsbox.infrastructure.Data;
using lmsbox.domain.Models;
using System.Security.Claims;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AdminLearningPathwaysController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public AdminLearningPathwaysController(ApplicationDbContext context)
    {
        _context = context;
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

        // Update courses
        if (request.CourseIds != null)
        {
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
        }

        // Update users
        if (request.UserIds != null)
        {
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
        }

        await _context.SaveChangesAsync();

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